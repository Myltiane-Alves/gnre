<?php

namespace Exemplo;

require '../vendor/autoload.php';

function carregarEnvArquivo($arquivo)
{
    if (!is_file($arquivo)) {
        return;
    }

    $linhas = file($arquivo, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($linhas as $linha) {
        $linha = trim($linha);
        if ($linha === '' || strpos($linha, '#') === 0) {
            continue;
        }

        $pos = strpos($linha, '=');
        if ($pos === false) {
            continue;
        }

        $chave = trim(substr($linha, 0, $pos));
        $valor = trim(substr($linha, $pos + 1));
        $valor = trim($valor, "\"'");

        if (getenv($chave) === false) {
            putenv($chave . '=' . $valor);
            $_ENV[$chave] = $valor;
        }
    }
}

function garantirArquivosPem()
{
    $certPath = getenv('CERT_CERT_PATH');
    $keyPath = getenv('CERT_KEY_PATH');

    if ($certPath && $keyPath && is_file($certPath) && is_file($keyPath)) {
        return;
    }

    $certB64 = getenv('CERT_PEM_CERT_BASE64');
    $keyB64 = getenv('CERT_PEM_KEY_BASE64');
    if (!$certB64 || !$keyB64) {
        return;
    }

    $tmpDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'gnre-php';
    if (!is_dir($tmpDir)) {
        mkdir($tmpDir, 0777, true);
    }

    $certRaw = base64_decode($certB64);
    $keyRaw = base64_decode($keyB64);
    if ($certRaw === false || $keyRaw === false) {
        return;
    }

    if (preg_match('/-----BEGIN CERTIFICATE-----.+?-----END CERTIFICATE-----/s', $certRaw, $mCert)) {
        $certRaw = $mCert[0] . PHP_EOL;
    }

    if (preg_match('/-----BEGIN(?: ENCRYPTED)? PRIVATE KEY-----.+?-----END(?: ENCRYPTED)? PRIVATE KEY-----/s', $keyRaw, $mKey)) {
        $keyRaw = $mKey[0] . PHP_EOL;
    }

    $certFile = $tmpDir . DIRECTORY_SEPARATOR . 'certificado.pem';
    $keyFile = $tmpDir . DIRECTORY_SEPARATOR . 'chave_privada.pem';

    file_put_contents($certFile, $certRaw);
    file_put_contents($keyFile, $keyRaw);

    putenv('CERT_CERT_PATH=' . $certFile);
    putenv('CERT_KEY_PATH=' . $keyFile);
    $_ENV['CERT_CERT_PATH'] = $certFile;
    $_ENV['CERT_KEY_PATH'] = $keyFile;
}

carregarEnvArquivo(__DIR__ . '/../../.env');
garantirArquivosPem();

class MySetup extends \Sped\Gnre\Configuration\Setup
{

    public function getBaseUrl()
    {
    return (string) getenv('GNRE_BASE_URL');
    }

    public function getCertificateCnpj()
    {
        $cnpj = preg_replace('/\D+/', '', (string) getenv('CERT_CNPJ'));
        return $cnpj !== '' ? $cnpj : 0;
    }

    public function getCertificateDirectory()
    {
        $certPath = (string) getenv('CERT_CERT_PATH');
        return $certPath !== '' ? dirname($certPath) . DIRECTORY_SEPARATOR : '';
    }

    public function getCertificateName()
    {
        $certPath = (string) getenv('CERT_CERT_PATH');
        return $certPath !== '' ? basename($certPath) : '';
    }

    public function getCertificatePassword()
    {
        return (string) getenv('SENHA');
    }

    public function getCertificatePemFile()
    {
        return (string) getenv('CERT_CERT_PATH');
    }

    public function getEnvironment()
    {
        return (int) (getenv('GNRE_ENV') ?: 2);
    }

    public function getPrivateKey()
    {
        return (string) getenv('CERT_KEY_PATH');
    }

    public function getProxyIp()
    {
        return (string) getenv('PROXY_IP');
    }

    public function getProxyPass()
    {
        return (string) getenv('PROXY_PASS');
    }

    public function getProxyPort()
    {
        return (int) getenv('PROXY_PORT');
    }

    public function getProxyUser()
    {
        return (string) getenv('PROXY_USER');
    }

    public function getDebug()
    {
        return false;
    }
}

function extrairLoteXml($xmlBruto)
{
    if (preg_match('/<TLote_GNRE[\s\S]*<\/TLote_GNRE>/i', $xmlBruto, $mLote)) {
        return trim($mLote[0]);
    }
    return trim($xmlBruto);
}

function montarEnvelope($loteXml, $versaoDados, $headerNamespace, $bodyNamespace, $modo)
{
    if ($modo === 'direct') {
        return '<?xml version="1.0" encoding="UTF-8"?>'
            . '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">'
            . '<soap12:Header><gnreCabecMsg xmlns="' . $headerNamespace . '"><versaoDados>' . $versaoDados . '</versaoDados></gnreCabecMsg></soap12:Header>'
            . '<soap12:Body><gnreDadosMsg xmlns="' . $bodyNamespace . '">' . $loteXml . '</gnreDadosMsg></soap12:Body>'
            . '</soap12:Envelope>';
    }

    return '<?xml version="1.0" encoding="UTF-8"?>'
        . '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" '
        . 'xmlns:gnre="' . $bodyNamespace . '">'
        . '<soap12:Header><gnreCabecMsg xmlns="' . $headerNamespace . '"><versaoDados>' . $versaoDados . '</versaoDados></gnreCabecMsg></soap12:Header>'
        . '<soap12:Body><gnre:processar><gnre:gnreDadosMsg><![CDATA[' . $loteXml . ']]></gnre:gnreDadosMsg></gnre:processar></soap12:Body>'
        . '</soap12:Envelope>';
}

function extrairCodigoSituacao($resposta)
{
    if (preg_match('/<[^>]*codigo[^>]*>(\d+)<\/[^>]*codigo>/i', $resposta, $m)) {
        return $m[1];
    }
    return null;
}

$lotes = array();
$caminhos = array(
    __DIR__ . '/../../lote-portal.xml',
    __DIR__ . '/xml/lote-emit-cnpj-dest-cnpj-sem-campos-extras.xml',
);

foreach ($caminhos as $caminho) {
    if (!is_file($caminho)) {
        continue;
    }
    $conteudo = file_get_contents($caminho);
    if ($conteudo === false || trim($conteudo) === '') {
        continue;
    }

    $loteXml = extrairLoteXml($conteudo);
    $versaoDetectada = (strpos($loteXml, 'versao="2.00"') !== false || strpos($loteXml, "versao='2.00'") !== false)
        ? '2.00'
        : '1.00';

    $lotes[] = array(
        'id' => basename($caminho),
        'xml' => $loteXml,
        'versao' => $versaoDetectada,
    );
}

if (count($lotes) === 0) {
    throw new \RuntimeException('Nao foi possivel carregar XML de lote para envio.');
}

$tentativas = array();
foreach ($lotes as $lote) {
    $tentativas[] = array(
        'id' => $lote['id'] . ':axis:hdr-wsdl:action-recepcao',
        'versaoDados' => $lote['versao'],
        'headerNs' => 'http://www.gnre.pe.gov.br/wsdl/processar',
        'bodyNs' => 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao',
        'mode' => 'axis-cdata',
        'action' => 'http://www.testegnre.pe.gov.br/webservice/GnreRecepcaoLote',
        'soapAction' => 'processar',
        'loteXml' => $lote['xml'],
    );
    $tentativas[] = array(
        'id' => $lote['id'] . ':axis:hdr-service:action-recepcao',
        'versaoDados' => $lote['versao'],
        'headerNs' => 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao',
        'bodyNs' => 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao',
        'mode' => 'axis-cdata',
        'action' => 'http://www.testegnre.pe.gov.br/webservice/GnreRecepcaoLote',
        'soapAction' => 'processar',
        'loteXml' => $lote['xml'],
    );
    $tentativas[] = array(
        'id' => $lote['id'] . ':axis:hdr-wsdl:action-processar',
        'versaoDados' => $lote['versao'],
        'headerNs' => 'http://www.gnre.pe.gov.br/wsdl/processar',
        'bodyNs' => 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao',
        'mode' => 'axis-cdata',
        'action' => 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao/processar',
        'soapAction' => 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao/processar',
        'loteXml' => $lote['xml'],
    );
    $tentativas[] = array(
        'id' => $lote['id'] . ':direct:hdr-wsdl:action-processar',
        'versaoDados' => $lote['versao'],
        'headerNs' => 'http://www.gnre.pe.gov.br/wsdl/processar',
        'bodyNs' => 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao',
        'mode' => 'direct',
        'action' => 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao/processar',
        'soapAction' => 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao/processar',
        'loteXml' => $lote['xml'],
    );
    $tentativas[] = array(
        'id' => $lote['id'] . ':axis:hdr-wsdl:action-recepcao:versao-1.00',
        'versaoDados' => '1.00',
        'headerNs' => 'http://www.gnre.pe.gov.br/wsdl/processar',
        'bodyNs' => 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao',
        'mode' => 'axis-cdata',
        'action' => 'http://www.testegnre.pe.gov.br/webservice/GnreRecepcaoLote',
        'soapAction' => 'processar',
        'loteXml' => $lote['xml'],
    );
    $tentativas[] = array(
        'id' => $lote['id'] . ':axis:hdr-wsdl:action-recepcao:versao-2.00',
        'versaoDados' => '2.00',
        'headerNs' => 'http://www.gnre.pe.gov.br/wsdl/processar',
        'bodyNs' => 'http://www.testegnre.pe.gov.br/webservice/GnreLoteRecepcao',
        'mode' => 'axis-cdata',
        'action' => 'http://www.testegnre.pe.gov.br/webservice/GnreRecepcaoLote',
        'soapAction' => 'processar',
        'loteXml' => $lote['xml'],
    );
}

$minhaConfiguracao = new MySetup();
$endpoint = 'https://www.testegnre.pe.gov.br/gnreWS/services/GnreLoteRecepcao';
$resultados = array();
$melhorResposta = null;

foreach ($tentativas as $t) {
    $xml = montarEnvelope($t['loteXml'], $t['versaoDados'], $t['headerNs'], $t['bodyNs'], $t['mode']);
    $headers = array(
        'Content-Type: application/soap+xml;charset=utf-8;action="' . $t['action'] . '"',
        'SOAPAction: ' . $t['soapAction'],
    );

    $webService = new \Sped\Gnre\Webservice\Connection($minhaConfiguracao, $headers, $xml);
    $webService->addCurlOption(array(
        CURLOPT_SSLVERSION => CURL_SSLVERSION_TLSv1,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_SSL_VERIFYPEER => 0,
        CURLOPT_KEYPASSWD => (string) getenv('SENHA'),
    ));

    $resposta = $webService->doRequest($endpoint);
    $codigo = extrairCodigoSituacao($resposta);

    $resultados[] = array(
        'id' => $t['id'],
        'versaoDados' => $t['versaoDados'],
        'codigo' => $codigo,
    );

    if ($codigo === '100' || $codigo === '1') {
        $melhorResposta = $resposta;
        break;
    }

    if ($melhorResposta === null) {
        $melhorResposta = $resposta;
    }
}

echo "\n===== RESUMO TENTATIVAS =====\n";
echo json_encode($resultados, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
echo "\n===== MELHOR RESPOSTA =====\n";
echo $melhorResposta;
