procedure TFrm_Recebimento.GerarNFCe_2026(NumNFe: String);
var
  contador: Integer;
  V_Tot_Desconto: Double;
  VrCalculado: Currency;
  V_ICMSTot_vNF: Double;
  v_TotICMS: Double;
  v_TotPis: Double;
  v_TotCofins: Double;
  OlhoImposto_Fed: Double;
  OlhoImposto_UF: Double;
  Msge: string;
  VrTotalVEnda, VrTotalTroco: Double;
  Erro: Boolean;
  V_TotalRecEletronico: Double;
  VrTotalRecEletronicoRecebido: Double;
  VrTotalRecEletronicoResto: Double;
begin
  lbMensagemSplass.Caption := 'Gerando NFCe v21';
  application.ProcessMessages;
  application.Restore;
  V_TotalRecEletronico := 0;
  VrTotalRecEletronicoRecebido := 0;
  VrTotalRecEletronicoResto := 0;
  VrTotalVEnda := 0;
  VrTotalTroco := 0;
  OlhoImposto_Fed := 0;
  OlhoImposto_UF := 0;
  v_TotCofins := 0;
  v_TotPis := 0;
  //
  contador := 0;
  V_ICMSTot_vNF := 0;
  v_TotICMS := 0;
  V_Tot_Desconto := 0;
  ACBrNFe1.NotasFiscais.Clear;
  LerConfiguracoes(true);
  lbMensagemSplass.Caption := 'Criando XML - NFCe!';
  application.ProcessMessages;
  application.Restore;
  // Verifica se na resumo venda possui Nº NFCe

  //
  DataModule2.TBEmpresa.Close;
  if (DataModule2.TBEmpresa.Active = False) then
    DataModule2.TBEmpresa.Open();
  DataModule2.TBEmpresa.Locate('IDEMPRESA', Form_Login.IDEmpresa, []);
  ACBrNFe1.NotasFiscais.Clear;
  with ACBrNFe1.NotasFiscais.Add.NFe do
  begin
    // Ide.cNF       := NFCE_Num; //Caso não seja preenchido será gerado um número aleatório pelo componente
    Ide.natOp := 'VENDA';
    Ide.indPag := ipVista;
    Ide.Modelo := 65;
    Ide.serie := strtoint(vNumLote);
    Ide.nNF := strtoint(NumNFe);
    Ide.dEmi := now();
    // Ide.dhCont    := DataModule2.TBResumoVendaDTHoraFechamento.AsDateTime;
    // Ide.xJust     :='Sistema sem conexão com a internet';
    Ide.dSaiEnt := Date();
    Ide.hSaiEnt := now();
    // DataModule2.TBResumoVendaDTHoraFechamento.AsDateTime;
    Ide.tpNF := tnSaida;

    // Ide.tpEmis    := TpcnTipoEmissao(cbFormaEmissao.ItemIndex);
    if (DataModule2.TBConfiguracaoTPFORMAEMISSAO.AsString = 'teNormal') then
      Ide.tpEmis := TpcnTipoEmissao(0);
    if (DataModule2.TBConfiguracaoTPFORMAEMISSAO.AsString = 'teContingencia')
    then
      Ide.tpEmis := TpcnTipoEmissao(1);
    if (DataModule2.TBConfiguracaoTPFORMAEMISSAO.AsString = 'teSCAN') then
      Ide.tpEmis := TpcnTipoEmissao(2);
    if (DataModule2.TBConfiguracaoTPFORMAEMISSAO.AsString = 'teDPEC') then
      Ide.tpEmis := TpcnTipoEmissao(3);
    if (DataModule2.TBConfiguracaoTPFORMAEMISSAO.AsString = 'teFSDA') then
      Ide.tpEmis := TpcnTipoEmissao(4);
    if (DataModule2.TBConfiguracaoTPFORMAEMISSAO.AsString = 'teSVCAN') then
      Ide.tpEmis := TpcnTipoEmissao(5);
    if (DataModule2.TBConfiguracaoTPFORMAEMISSAO.AsString = 'teSVCRS') then
      Ide.tpEmis := TpcnTipoEmissao(6);
    if (DataModule2.TBConfiguracaoTPFORMAEMISSAO.AsString = 'teSVCSP') then
      Ide.tpEmis := TpcnTipoEmissao(7);
    if (DataModule2.TBConfiguracaoTPFORMAEMISSAO.AsString = 'teOffLine') then
      Ide.tpEmis := TpcnTipoEmissao(8);

    // Ide.tpAmb     := taHomologacao;  //Lembre-se de trocar esta variÃ¡vel quando for para ambiente de produÃ§Ã£o
    if (DataModule2.TBConfiguracaoTPAMBIENTE.AsString = 'taHomologacao') or
      (DataModule2.TBConfiguracaoTPAMBIENTE.AsString = 'Homologacao') or
      (DataModule2.TBConfiguracaoTPAMBIENTE.AsString = 'Homologação') then
      Ide.TpAmb := taHomologacao
    else
      Ide.TpAmb := taProducao;
    //
    // Ide.tpAmb     := taHomologacao;
    Ide.cUF := UFtoCUF(DataModule2.TBConfiguracaoUF.AsString);
    Ide.cMunFG := strtoint(DataModule2.TBEmpresaNUIBGE.AsString);
    Ide.finNFe := fnNormal;
    Ide.tpImp := tiNFCe;
    Ide.indFinal := cfConsumidorFinal;
    //
    // Verifica se existe presencial
    //
    Ide.indPres := pcPresencial;

    // Ide.dhCont := date;
    // Ide.xJust  := 'Justificativa Contingencia';

    // Reforma Tributária
    Ide.cMunFGIBS := strtoint(DataModule2.TBEmpresaNUIBGE.AsString);

    Ide.tpNFDebito := tdNenhum;
    Ide.tpNFCredito := tcNenhum;

    Ide.gCompraGov.tpEnteGov := tcgEstados;
    Ide.gCompraGov.pRedutor := 5;
    Ide.gCompraGov.tpOperGov := togFornecimento;
    /// ///////////////////////////////////////////////////////////////
    /// ////////////////////////////////////////////////////////////

    Emit.CNPJCPF := DataModule2.TBEmpresaNUCNPJ.AsString;
    Emit.IE := DataModule2.TBEmpresaNUINSCESTADUAL.AsString;
    Emit.xNome := DataModule2.TBEmpresaNORAZAOSOCIAL.AsString;
    Emit.xFant := DataModule2.TBEmpresaNOFANTASIA.AsString;

    Emit.EnderEmit.fone := DataModule2.TBEmpresaNUTELPUBLICO.AsString;
    Emit.EnderEmit.CEP := strtoint(DataModule2.TBEmpresaNUCEP.AsString);
    Emit.EnderEmit.xLgr := DataModule2.TBEmpresaEENDERECO.AsString;
    Emit.EnderEmit.nro := '0';
    Emit.EnderEmit.xCpl := DataModule2.TBEmpresaECOMPLEMENTO.AsString;
    Emit.EnderEmit.xBairro := DataModule2.TBEmpresaEBAIRRO.AsString;
    Emit.EnderEmit.cMun := strtoint(DataModule2.TBEmpresaNUIBGE.AsString);
    Emit.EnderEmit.xMun := DataModule2.TBEmpresaECIDADE.AsString;
    Emit.EnderEmit.UF := DataModule2.TBEmpresaSGUF.AsString;
    Emit.EnderEmit.cPais := 1058;
    Emit.EnderEmit.xPais := 'BRASIL';

    Emit.IEST := '';
    // Emit.IM                := '2648800'; // Preencher no caso de existir serviços na nota
    // Emit.CNAE              := '6201500'; // Verifique na cidade do emissor da NFe se é permitido
    // a inclusão de serviços na NFe
    // Emit.CRT               := crtRegimeNormal;// (1-crtSimplesNacional, 2-crtSimplesExcessoReceita, 3-crtRegimeNormal)
    if (DataModule2.TBConfiguracaoDSCRT.AsString = 'crtSimplesNacional') then
      Emit.CRT := crtSimplesNacional;
    if (DataModule2.TBConfiguracaoDSCRT.AsString = 'crtSimplesExcessoReceita')
    then
      Emit.CRT := crtSimplesExcessoReceita;
    if (DataModule2.TBConfiguracaoDSCRT.AsString = 'crtRegimeNormal') then
      Emit.CRT := crtRegimeNormal;

    if (Length(Frm_PDV.NuCPF) > 0) then
      Dest.CNPJCPF := Frm_PDV.NuCPF
    else
      Dest.CNPJCPF := '';
    Dest.indIEDest := inNaoContribuinte;
    Dest.ISUF := '';
    if (Length(Frm_PDV.V_Str_NomeRazao) = 0) then
      Dest.xNome := 'Não Informado'
    else
      Dest.xNome := Frm_PDV.V_Str_NomeRazao;
    if (Length(Frm_PDV.V_Str_Endereco) = 0) then
      Dest.EnderDest.xLgr := 'Não Informado'
    else
      Dest.EnderDest.xLgr := Frm_PDV.V_Str_Endereco;

    Dest.EnderDest.nro := 'S/N';

    if (Length(Frm_PDV.V_Str_Complemento) = 0) then
      Dest.EnderDest.xCpl := ''
    else
      Dest.EnderDest.xCpl := Frm_PDV.V_Str_Complemento;

    if (Length(Frm_PDV.V_Str_Bairro) = 0) then
      Dest.EnderDest.xBairro := 'Não Informado'
    else
      Dest.EnderDest.xBairro := Frm_PDV.V_Str_Bairro;

    if (Length(Frm_PDV.V_Str_NuIBGE) = 0) then
      Dest.EnderDest.cMun := strtoint(DataModule2.TBEmpresaNUIBGE.AsString)
    else
      Dest.EnderDest.cMun := strtoint(Frm_PDV.V_Str_NuIBGE);

    if (Length(Frm_PDV.V_Str_Cidade) = 0) then
      Dest.EnderDest.xMun := DataModule2.TBEmpresaECIDADE.AsString
    else
      Dest.EnderDest.xMun := Frm_PDV.V_Str_Cidade;

    if (Length(Frm_PDV.V_Str_UF) = 0) then
      Dest.EnderDest.UF := DataModule2.TBEmpresaSGUF.AsString
    else
      Dest.EnderDest.UF := Frm_PDV.V_Str_UF;

    Dest.EnderDest.cPais := 1058;
    Dest.EnderDest.xPais := 'BRASIL';
    // end;
    autXML.Add.CNPJCPF := '11098707000107';

    // Adicionando Produtos
    DataModule2.Query.Close;
    DataModule2.Query.SQL.Text :=
      'select tbproduto.idproduto, tbproduto.nucodbarras,tbproduto.dsnome,tbproduto.nuncm, '
      + 'tbproduto.und, ' +
      'tbdetalhevenda.qtd, tbdetalhevenda.vrunit, tbproduto.nucest, tbproduto.percicms, tbdetalhevenda.vrdesconto, tbdetalhevenda.vrtotalliquido '
      + 'from tbdetalhevenda ' +
      'inner join tbproduto on tbdetalhevenda.idproduto=tbproduto.idproduto ' +
      'where tbdetalhevenda.idresumovenda=:idresumovenda and tbdetalhevenda.stativo=:stativo';
    DataModule2.Query.ParamByName('idresumovenda').AsInteger :=
      Frm_PDV.IDResumoVenda;
    DataModule2.Query.ParamByName('stativo').AsString := 'True';
    DataModule2.Query.Open();
    Form_Login.LogVenda
      ('[Fechamento de Venda](GerarNFCe) Recupera DetalheVenda da Venda nº' +
      inttostr(Frm_PDV.IDResumoVenda) + '  ' + DateTimeToStr(now()));

    if not(DataModule2.Query.eof) then
    begin
      DataModule2.Query.First;
      repeat
        contador := contador + 1;

        with Det.Add do
        begin
          Prod.nItem := contador;
          // Número sequencial, para cada item deve ser incrementado
          Prod.cProd := DataModule2.Query.FieldByName('idproduto').AsString;
          Form_Login.LogVenda('[Fechamento de Venda](GerarNFCe) Add Item nº' +
            DataModule2.Query.FieldByName('idproduto').AsString + '  ' +
            DateTimeToStr(now()));

          if (TestarEan(DataModule2.Query.FieldByName('nucodbarras').AsString))
          then
            Prod.cEAN := DataModule2.Query.FieldByName('nucodbarras').AsString
          else
            Prod.cEAN := 'SEM GTIN';

          Prod.xProd := DataModule2.Query.FieldByName('dsnome').AsString;
          Prod.NCM := Format('%8.8d',
            [strtoint(DataModule2.Query.FieldByName('nuncm').AsString)]);
          // Tabela NCM disponível em  http://www.receita.fazenda.gov.br/Aliquotas/DownloadArqTIPI.htm
          Prod.EXTIPI := '';

          Prod.CFOP := '5102';
          if (Length(DataModule2.Query.FieldByName('und').AsString) > 0) then
            Prod.uCom := DataModule2.Query.FieldByName('und').AsString
          else
            Prod.uCom := 'UN';

          Prod.qCom := RoundTo(DataModule2.Query.FieldByName('qtd')
            .AsCurrency, -2);
          //
          VrCalculado :=
            RoundTo(((DataModule2.Query.FieldByName('vrunit').AsCurrency *
            DataModule2.Query.FieldByName('qtd').AsCurrency) -
            DataModule2.Query.FieldByName('vrdesconto').AsCurrency), -2);
          //
          Prod.vUnCom := DataModule2.Query.FieldByName('vrunit').AsCurrency;

          Prod.vDesc := DataModule2.Query.FieldByName('vrdesconto').AsCurrency;
          // VrUnitCalculado
          //
          V_Tot_Desconto := V_Tot_Desconto +
            RoundTo(DataModule2.Query.FieldByName('vrdesconto').AsCurrency, -2);
          //

          Prod.vProd := DataModule2.Query.FieldByName('vrunit').AsCurrency *
            Prod.qCom;
          V_ICMSTot_vNF := V_ICMSTot_vNF + VrCalculado;
          { if (Length(DataModule2.TBDetalheVendanucodbarras.AsString)=13) then
            Prod.cEANTrib  := DataModule2.TBDetalheVendanucodbarras.AsString
            else }
          if (Length(DataModule2.Query.FieldByName('und').AsString) > 0) then
            Prod.uTrib := DataModule2.Query.FieldByName('und').AsString
          else
            Prod.uTrib := 'UN';
          Prod.qTrib := RoundTo(DataModule2.Query.FieldByName('qtd')
            .AsCurrency, -2);
          Prod.vUnTrib := DataModule2.Query.FieldByName('vrunit').AsCurrency;

          Prod.vOutro := 0;
          Prod.vFrete := 0;
          Prod.vSeg := 0;
          // Prod.vDesc     := 0;
          Prod.CEST := '';
          // infAdProd      := 'Informação Adicional do Produto';

          // Reforma Tributária
          // Indicador de fornecimento de bem móvel usado
            Prod.indBemMovelUsado := tieNenhum;

            // Valor total do Item, correspondente à sua participação no total da nota.
            // A soma dos itens deverá corresponder ao total da nota.
            //vItem := 100;
            // Referenciamento de item de outro Documento Fiscal Eletrônico - DF-e
            //DFeReferenciado.chaveAcesso := '';
            //DFeReferenciado.nItem := 1;
          ////////////////////////////////////////////////////////////////////
          ///////////////////////////////////////////////////////////////////

          with Imposto do
          begin
            // lei da transparencia nos impostos
            vTotTrib := 0;
            if (DataModule2.TBConfiguracaoDSCRT.AsString = 'crtSimplesNacional')
            then
            begin

              with ICMS do
              begin
                CSOSN := csosn102;
                ICMS.orig := oeNacional;
                ICMS.modBC := dbiValorOperacao;
                ICMS.vBC := 0;
                ICMS.pICMS := 0;
                ICMS.vICMS := 0;
                ICMS.modBCST := dbisMargemValorAgregado;
                ICMS.pMVAST := 0;
                ICMS.pRedBCST := 0;
                ICMS.vBCST := 0;
                ICMS.pICMSST := 0;
                ICMS.vICMSST := 0;
                ICMS.pRedBC := 0;

                // partilha do ICMS e fundo de probreza
                with ICMSUFDest do
                begin
                  vBCUFDest := 0.00;
                  pFCPUFDest := 0.00;
                  pICMSUFDest := 0.00;
                  pICMSInter := 0.00;
                  pICMSInterPart := 0.00;
                  vFCPUFDest := 0.00;
                  vICMSUFDest := 0.00;
                  vICMSUFRemet := 0.00;
                end;
              end;
            end
            else
            begin
              with ICMS do
              begin
                CST := cst00;
                ICMS.orig := oeNacional;
                ICMS.modBC := dbiValorOperacao;
                // tbproduto.PERCALIIMPOSTO
                ICMS.vBC := VrCalculado;
                if (DataModule2.Query.FieldByName('nuncm')
                  .AsString = '38089429') or
                  (DataModule2.Query.FieldByName('nuncm').AsString = '22072019')
                then
                begin
                  if (DataModule2.TBEmpresaSGUF.AsString = 'DF') then
                  begin
                    CST := cst40;
                    ICMS.pICMS := 0;
                    ICMS.vICMS := 0;
                    // v_TotICMS  := 0;
                    // v_TotICMS  := v_TotICMS;
                  end
                  else
                  begin
                    ICMS.pICMS := 19.00;
                    ICMS.vICMS := RoundTo(VrCalculado * (19.00 / 100), -2);
                    v_TotICMS := v_TotICMS +
                      RoundTo(VrCalculado * (19.00 / 100), -2);
                  end;
                end
                else
                begin
                  if (DataModule2.TBEmpresaSGUF.AsString = 'DF') then
                  begin
                    if (DataModule2.Query.FieldByName('percicms').AsCurrency
                      >= 12) then
                    begin
                      ICMS.pICMS := DataModule2.Query.FieldByName('percicms')
                        .AsCurrency;
                      ICMS.vICMS :=
                        RoundTo(VrCalculado *
                        (DataModule2.Query.FieldByName('percicms').AsCurrency /
                        100), -2);
                      v_TotICMS := v_TotICMS +
                        RoundTo(VrCalculado *
                        (DataModule2.Query.FieldByName('percicms').AsCurrency /
                        100), -2);
                    end
                    else
                    begin
                      ICMS.pICMS := 20;
                      ICMS.vICMS := RoundTo(VrCalculado * (20.00 / 100), -2);
                      v_TotICMS := v_TotICMS +
                        RoundTo(VrCalculado * (20.00 / 100), -2);
                    end;

                  end
                  else
                  begin
                    ICMS.pICMS := 19.00;
                    ICMS.vICMS := RoundTo(VrCalculado * (19.00 / 100), -2);
                    v_TotICMS := v_TotICMS +
                      RoundTo(VrCalculado * (19.00 / 100), -2);
                  end;

                end;
                ICMS.modBCST := dbisMargemValorAgregado;
                ICMS.pMVAST := 0;
                ICMS.pRedBCST := 0;
                ICMS.vBCST := 0;
                ICMS.pICMSST := 0;
                ICMS.vICMSST := 0;
                ICMS.pRedBC := 0;

                // partilha do ICMS e fundo de probreza
                with ICMSUFDest do
                begin
                  vBCUFDest := 0.00;
                  pFCPUFDest := 0.00;
                  pICMSUFDest := 0.00;
                  pICMSInter := 0.00;
                  pICMSInterPart := 0.00;
                  vFCPUFDest := 0.00;
                  vICMSUFDest := 0.00;
                  vICMSUFRemet := 0.00;
                end;
              end;
              //
              with PIS do
              begin
                if (DataModule2.Query.FieldByName('nuncm').AsString = '38089429')
                then
                begin
                  CST := pis04;
                  PIS.vBC := 0;
                  // DataModule2.Query.FieldByName('vrtotalliquido').AsCurrency;
                  PIS.pPIS := 0;
                  PIS.vPIS := 0;
                  // RoundTo((DataModule2.Query.FieldByName('vrtotalliquido').AsCurrency * 0.0165), -2);
                  // v_TotPis      := v_TotPis;// + RoundTo((DataModule2.Query.FieldByName('vrtotalliquido').AsCurrency * 0.0165), -2);
                  PIS.qBCProd := 0;
                  PIS.vAliqProd := 0;

                end
                else
                begin
                  CST := pis01;
                  PIS.vBC := VrCalculado;
                  PIS.pPIS := 1.6500;
                  PIS.vPIS := RoundTo((VrCalculado * 0.0165), -2);
                  v_TotPis := v_TotPis + RoundTo((VrCalculado * 0.0165), -2);
                  PIS.qBCProd := 0;
                  PIS.vAliqProd := 0;
                end;
              end;

              with PISST do
              begin
                vBC := 0;
                pPIS := 0;
                qBCProd := 0;
                vAliqProd := 0;
                vPIS := 0;
              end;

              with COFINS do
              begin
                if (DataModule2.Query.FieldByName('nuncm').AsString = '38089429')
                then
                begin
                  CST := cof04;
                  COFINS.vBC := 0;
                  // DataModule2.Query.FieldByName('vrtotalliquido').AsCurrency;
                  COFINS.pCOFINS := 0; // 7.60;
                  COFINS.vCOFINS := 0;
                  // RoundTo((DataModule2.Query.FieldByName('vrtotalliquido').AsCurrency * 0.076), -2);
                  // v_TotCofins      := v_TotCofins;// + RoundTo((DataModule2.Query.FieldByName('vrtotalliquido').AsCurrency * 0.076), -2);
                  COFINS.qBCProd := 0;
                  COFINS.vAliqProd := 0;
                end
                else
                begin
                  CST := cof01;
                  COFINS.vBC := VrCalculado;
                  COFINS.pCOFINS := 7.60;
                  COFINS.vCOFINS := RoundTo((VrCalculado * 0.076), -2);
                  v_TotCofins := v_TotCofins +
                    RoundTo((VrCalculado * 0.076), -2);
                  COFINS.qBCProd := 0;
                  COFINS.vAliqProd := 0;
                end;
              end;

              with COFINSST do
              begin
                vBC := 0;
                pCOFINS := 0;
                qBCProd := 0;
                vAliqProd := 0;
                vCOFINS := 0;
              end;
              //
              // Reforma Tributária
              // Informações do tributo: Imposto Seletivo
              //ISel.CSTIS := cstis000;
              //ISel.cClassTribIS := '000001';

              //ISel.vBCIS := 100;
              //ISel.PIS := 5;
              //ISel.pISEspec := 5;
              //ISel.uTrib := 'UNIDAD';
              //ISel.qTrib := 10;
              //ISel.vIS := 100;

              {
                Utilize os CST (cst000, cst200, cst220 e cst510) e os cClassTrib
                correspondentes para gerar o grupo IBSCBS
                Utilize o CST cst620 e os cClassTrib correspondentes para gerar o grupo
                IBSCBSMono
              }

              // Informações do tributo: IBS / CBS
              IBSCBS.CST := cst000;
              IBSCBS.cClassTrib := '000001';

              IBSCBS.gIBSCBS.vBC := VrCalculado;
              IBSCBS.gIBSCBS.vIBS := 100;

              IBSCBS.gIBSCBS.gIBSUF.pIBSUF := 0.10;
              IBSCBS.gIBSCBS.gIBSUF.vIBSUF := RoundTo(VrCalculado * (0.10/100),2);

              //IBSCBS.gIBSCBS.gIBSUF.gDif.pDif := 0;
              //IBSCBS.gIBSCBS.gIBSUF.gDif.vDif := 0;

              //IBSCBS.gIBSCBS.gIBSUF.gDevTrib.vDevTrib := 0;

              //IBSCBS.gIBSCBS.gIBSUF.gRed.pRedAliq := 0;
              //IBSCBS.gIBSCBS.gIBSUF.gRed.pAliqEfet := 0;

              IBSCBS.gIBSCBS.gIBSMun.pIBSMun := 0;
              IBSCBS.gIBSCBS.gIBSMun.vIBSMun := 0;

              //IBSCBS.gIBSCBS.gIBSMun.gDif.pDif := 0;
              //IBSCBS.gIBSCBS.gIBSMun.gDif.vDif := 0;

              //IBSCBS.gIBSCBS.gIBSMun.gDevTrib.vDevTrib := 0;

              //IBSCBS.gIBSCBS.gIBSMun.gRed.pRedAliq := 0;
              //IBSCBS.gIBSCBS.gIBSMun.gRed.pAliqEfet := 0;

              IBSCBS.gIBSCBS.gCBS.pCBS := 0.90;
              IBSCBS.gIBSCBS.gCBS.vCBS := RoundTo(VrCalculado * (0.90/100),2);

              //IBSCBS.gIBSCBS.gCBS.gDif.pDif := 5;
              //IBSCBS.gIBSCBS.gCBS.gDif.vDif := 100;

              //IBSCBS.gIBSCBS.gCBS.gDevTrib.vDevTrib := 100;

              //IBSCBS.gIBSCBS.gCBS.gRed.pRedAliq := 5;
              //IBSCBS.gIBSCBS.gCBS.gRed.pAliqEfet := 5;

              //IBSCBS.gIBSCBS.gTribRegular.CSTReg := cst000;
              //IBSCBS.gIBSCBS.gTribRegular.cClassTribReg := '000001';
              //IBSCBS.gIBSCBS.gTribRegular.pAliqEfetRegIBSUF := 5;
              //IBSCBS.gIBSCBS.gTribRegular.vTribRegIBSUF := 50;
              //IBSCBS.gIBSCBS.gTribRegular.pAliqEfetRegIBSMun := 5;
              //IBSCBS.gIBSCBS.gTribRegular.vTribRegIBSMun := 50;
              //IBSCBS.gIBSCBS.gTribRegular.pAliqEfetRegCBS := 5;
              //IBSCBS.gIBSCBS.gTribRegular.vTribRegCBS := 50;

              //IBSCBS.gIBSCBS.gIBSCredPres.cCredPres := cp01;
              //IBSCBS.gIBSCBS.gIBSCredPres.pCredPres := 5;
              //IBSCBS.gIBSCBS.gIBSCredPres.vCredPres := 100;
              //IBSCBS.gIBSCBS.gIBSCredPres.vCredPresCondSus := 100;

              //IBSCBS.gIBSCBS.gCBSCredPres.cCredPres := cp01;
              //IBSCBS.gIBSCBS.gCBSCredPres.pCredPres := 5;
              //IBSCBS.gIBSCBS.gCBSCredPres.vCredPres := 100;
              //IBSCBS.gIBSCBS.gCBSCredPres.vCredPresCondSus := 100;

              // Tipo Tributação Compra Governamental
              //IBSCBS.gIBSCBS.gTribCompraGov.pAliqIBSUF := 5;
              //IBSCBS.gIBSCBS.gTribCompraGov.vTribIBSUF := 50;
              //IBSCBS.gIBSCBS.gTribCompraGov.pAliqIBSMun := 5;
              //IBSCBS.gIBSCBS.gTribCompraGov.vTribIBSMun := 50;
              //IBSCBS.gIBSCBS.gTribCompraGov.pAliqCBS := 5;
              //IBSCBS.gIBSCBS.gTribCompraGov.vTribCBS := 50;

              // Informações do tributo: IBS / CBS em operações com imposto monofásico
              //IBSCBS.gIBSCBSMono.gMonoPadrao.qBCMono := 1;
              //IBSCBS.gIBSCBSMono.gMonoPadrao.adRemIBS := 5;
              //IBSCBS.gIBSCBSMono.gMonoPadrao.adRemCBS := 5;
              //IBSCBS.gIBSCBSMono.gMonoPadrao.vIBSMono := 100;
              //IBSCBS.gIBSCBSMono.gMonoPadrao.vCBSMono := 100;

              //IBSCBS.gIBSCBSMono.gMonoReten.qBCMonoReten := 1;
              //IBSCBS.gIBSCBSMono.gMonoReten.adRemIBSReten := 5;
              //IBSCBS.gIBSCBSMono.gMonoReten.vIBSMonoReten := 100;
              //IBSCBS.gIBSCBSMono.gMonoReten.vCBSMonoReten := 100;

              //IBSCBS.gIBSCBSMono.gMonoRet.qBCMonoRet := 1;
              //IBSCBS.gIBSCBSMono.gMonoRet.adRemIBSRet := 5;
              //IBSCBS.gIBSCBSMono.gMonoRet.vIBSMonoRet := 100;
              //IBSCBS.gIBSCBSMono.gMonoRet.vCBSMonoRet := 100;

              //IBSCBS.gIBSCBSMono.gMonoDif.pDifIBS := 5;
              //IBSCBS.gIBSCBSMono.gMonoDif.vIBSMonoDif := 100;
              //IBSCBS.gIBSCBSMono.gMonoDif.pDifCBS := 5;
              //IBSCBS.gIBSCBSMono.gMonoDif.vCBSMonoDif := 100;

              //IBSCBS.gIBSCBSMono.vTotIBSMonoItem := 100;
              //IBSCBS.gIBSCBSMono.vTotCBSMonoItem := 100;

              /// ////////////////////////////////////////////////////////////////
              /// //////////////////////////////////////////////////////////////
            end;

          end;
        end;

        DataModule2.Query.Next;
      until (DataModule2.Query.eof);

      if (DataModule2.TBConfiguracaoDSCRT.AsString = 'crtSimplesNacional') then
      begin
        Total.ICMSTot.vBC := 0;
        Total.ICMSTot.vICMS := 0;
        Total.ICMSTot.vBCST := 0;
        Total.ICMSTot.vST := 0;
        Total.ICMSTot.vProd := V_ICMSTot_vNF;
        Total.ICMSTot.vFrete := 0;
        Total.ICMSTot.vSeg := 0;
        Total.ICMSTot.vDesc := 0;
        Total.ICMSTot.vII := 0;
        Total.ICMSTot.vIPI := 0;
        Total.ICMSTot.vPIS := 0;
        Total.ICMSTot.vCOFINS := 0;
        Total.ICMSTot.vOutro := 0;
        Total.ICMSTot.vNF := V_ICMSTot_vNF;

        // partilha do icms e fundo de probreza
        Total.ICMSTot.vFCPUFDest := 0.00;
        Total.ICMSTot.vICMSUFDest := 0.00;
        Total.ICMSTot.vICMSUFRemet := 0.00;

        Total.ISSQNtot.vServ := 0;
        Total.ISSQNtot.vBC := 0;
        Total.ISSQNtot.vISS := 0;
        Total.ISSQNtot.vPIS := 0;
        Total.ISSQNtot.vCOFINS := 0;
      end
      else
      begin
        Total.ICMSTot.vBC := V_ICMSTot_vNF;
        Total.ICMSTot.vICMS := v_TotICMS;
        Total.ICMSTot.vBCST := 0;
        Total.ICMSTot.vST := 0;
        Total.ICMSTot.vProd := V_ICMSTot_vNF + V_Tot_Desconto;
        Total.ICMSTot.vFrete := 0;
        Total.ICMSTot.vSeg := 0;
        Total.ICMSTot.vDesc := V_Tot_Desconto;
        Total.ICMSTot.vII := 0;
        Total.ICMSTot.vIPI := 0;
        Total.ICMSTot.vPIS := v_TotPis;
        Total.ICMSTot.vCOFINS := v_TotCofins;
        Total.ICMSTot.vOutro := 0;
        Total.ICMSTot.vNF := V_ICMSTot_vNF;

        // partilha do icms e fundo de probreza
        Total.ICMSTot.vFCPUFDest := 0.00;
        Total.ICMSTot.vICMSUFDest := 0.00;
        Total.ICMSTot.vICMSUFRemet := 0.00;

        Total.ISSQNtot.vServ := 0;
        Total.ISSQNtot.vBC := 0;
        Total.ISSQNtot.vISS := 0;
        Total.ISSQNtot.vPIS := 0;
        Total.ISSQNtot.vCOFINS := 0;
      end;
      { Total.retTrib.vRetPIS    := 0;
        Total.retTrib.vRetCOFINS := 0;
        Total.retTrib.vRetCSLL   := 0;
        Total.retTrib.vBCIRRF    := 0;
        Total.retTrib.vIRRF      := 0;
        Total.retTrib.vBCRetPrev := 0;
        Total.retTrib.vRetPrev   := 0; }

      // Reforma Tributária
      Total.ISTot.vIS := 0;

      Total.IBSCBSTot.vBCIBSCBS := VrCalculado;

      Total.IBSCBSTot.gIBS.vIBS := 100;
      Total.IBSCBSTot.gIBS.vCredPres := 100;
      Total.IBSCBSTot.gIBS.vCredPresCondSus := 100;

      Total.IBSCBSTot.gIBS.gIBSUFTot.vDif := 0;
      Total.IBSCBSTot.gIBS.gIBSUFTot.vDevTrib := 0;
      Total.IBSCBSTot.gIBS.gIBSUFTot.vIBSUF := RoundTo(VrCalculado * (0.10/100),2);

      Total.IBSCBSTot.gIBS.gIBSMunTot.vDif := 0;
      Total.IBSCBSTot.gIBS.gIBSMunTot.vDevTrib := 0;
      Total.IBSCBSTot.gIBS.gIBSMunTot.vIBSMun := 0;

      Total.IBSCBSTot.gCBS.vDif := 0;
      Total.IBSCBSTot.gCBS.vDevTrib := 0;
      Total.IBSCBSTot.gCBS.vCBS :=  RoundTo(VrCalculado * (0.90/100),2);;
      Total.IBSCBSTot.gCBS.vCredPres := 0;
      Total.IBSCBSTot.gCBS.vCredPresCondSus := 0;

      //Total.IBSCBSTot.gMono.vIBSMono := 100;
      //Total.IBSCBSTot.gMono.vCBSMono := 100;
      ////Total.IBSCBSTot.gMono.vIBSMonoReten := 100;
      //Total.IBSCBSTot.gMono.vCBSMonoReten := 100;
      //Total.IBSCBSTot.gMono.vIBSMonoRet := 100;
      //Total.IBSCBSTot.gMono.vCBSMonoRet := 100;

      // Valor total da NF-e com IBS / CBS / IS
      //Total.vNFTot := 100;
    ///////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////

      Transp.modFrete := mfSemFrete; // NFC-e não pode ter FRETE

      OlhoImposto_Fed := (V_ICMSTot_vNF) * 0.2524;
      OlhoImposto_UF := (V_ICMSTot_vNF) * 0.1941;
      //
      VrTotalVEnda := VrRecebidoDinheiro + VrRecebidoCheque + VrRecebidoCartao +
        VrRecebidoConvenio + VrRecebidoPOS + VrRecebidoVoucher;
      Frm_PDV.VrTroco := RoundTo((VrTotalVEnda - V_ICMSTot_vNF), -2);
      if VrTotalVEnda <> V_ICMSTot_vNF then
      begin
        if VrTotalVEnda > V_ICMSTot_vNF then
        begin
          pag.vtroco := Frm_PDV.VrTroco;
        end
        ELSE
        BEGIN
          if VrTotalVEnda < V_ICMSTot_vNF then
          begin
            with pag.Add do // PAGAMENTOS apenas para NFC-e
            begin
              tPag := fpDinheiro;
              vPag := V_ICMSTot_vNF - VrTotalVEnda;
            end;
          end;
        END;
      end;

      //
      if ((VrRecebidoDinheiro) > 0) then
        with pag.Add do // PAGAMENTOS apenas para NFC-e
        begin
          tPag := fpDinheiro;
          vPag := VrRecebidoDinheiro;
          Form_Login.LogVenda
            ('[Fechamento de Venda](GerarNFCe) VrRecebidoDinheiro=' +
            floattostrf(VrRecebidoDinheiro, ffFixed, 12, 2) + '  ' +
            DateTimeToStr(now()));

        end;

      if ((VrRecebidoCheque) > 0) then
        with pag.Add do // PAGAMENTOS apenas para NFC-e
        begin
          tPag := fpCheque;
          vPag := VrRecebidoCheque;
          Form_Login.LogVenda('[Fechamento de Venda](GerarNFCe) vPag := ' +
            floattostrf(VrRecebidoCheque, ffFixed, 12, 2) + '  ' +
            DateTimeToStr(now()));

        end;

      if ((VrRecebidoCartao) > 0) then
        with pag.Add do
        begin
          tPag := fpCartaoCredito;
          vPag := VrRecebidoCartao;
          tpIntegra := tiPagNaoIntegrado;
        end;

      if ((VrRecebidoConvenio) > 0) then
        with pag.Add do
        begin
          tPag := fpCreditoLoja;
          vPag := VrRecebidoConvenio;
        end;

      if ((VrRecebidoPOS) > 0) then
        with pag.Add do
        begin
          tPag := fpCartaoDebito;
          vPag := VrRecebidoPOS;
          tpIntegra := tiPagNaoIntegrado;
        end;

      if ((VrRecebidoVoucher) > 0) then
        with pag.Add do
        begin
          tPag := fpCreditoLoja;
          vPag := VrRecebidoVoucher;
        end;

      InfAdic.infCpl := 'Você pagou aproximadamente;' + 'R$ ' +
        floattostrf(OlhoImposto_Fed, ffnumber, 12, 2) + ' tributos federais;' +
        'R$ ' + floattostrf(OlhoImposto_UF, ffnumber, 12, 2) +
        ' tributos estaduais;' + 'R$ 0,00 tributos municipais;' +
        'Fonte: IBPT/FECOMERCIO RS      Xe67Eq;' + Form_Login.EnderecoProcon +
        'Nº VENDA: ' + Frm_PDV.IDResumoVendaWeb + ';' + ';' +
        'PRAZO DE TROCA: VÁLIDO POR 30 DIAS;';

      InfAdic.infAdFisco := '';

      { with InfAdic.obsCont.Add do
        begin
        xCampo := 'ObsCont';
        xTexto := 'Texto';
        end;

        with InfAdic.obsFisco.Add do
        begin
        xCampo := 'ObsFisco';
        xTexto := 'Texto';
        end; }
    end;
    lbMensagemSplass.Caption := 'Processar NFCe [Assinando] ' + NumNFe;
    //
    Form_Login.LogVenda
      ('[Fechamento de Venda](GerarNFCe) ACBrNFe1.NotasFiscais.Assinar;  ' +
      DateTimeToStr(now()));

    try
      ACBrNFe1.NotasFiscais.Assinar;
    except
      Form_Login.LogVenda('(CriarEnviarCFe) Erro ao Assinar; ' +
        DateTimeToStr(now()));

      showmessage('Falha na assinatura da nota. Prossiga.');
    end;
    //
    if not ACBrNFe1.NotasFiscais.VerificarAssinatura(Msge) then
    Begin
      showmessage('Erro ao assinar nota fiscal eletronica : ' + Msge);
      Form_Login.LogVenda
        ('[Fechamento de Venda](GerarNFCe) Erro ao assinar nota fiscal eletronica : '
        + Msge + ' ' + DateTimeToStr(now()));

    End;
    application.ProcessMessages;
    application.Restore;
    { except
      showmessage('Erro ao assinar');
      exit;
      end; }
    lbMensagemSplass.Caption := 'Processar NFCe [Validando] ';
    try

      ACBrNFe1.NotasFiscais.Validar;
      lbMensagemSplass.Caption := 'Validada - NFCe nº: ' + NumNFe;
      Form_Login.LogVenda
        ('[Fechamento de Venda](GerarNFCe) ACBrNFe1.NotasFiscais.Validar; ' +
        DateTimeToStr(now()));
      application.ProcessMessages;
    except
      on e: exception do
      begin
        MessageDlg('Atenção! TECLE [OK] ' + #13'Erro na validação das notas ' +
          e.Message, mterror, [mbOk], 0);
        Form_Login.LogVenda('[Fechamento de Venda](GerarNFCe) Erro ao Validar; '
          + DateTimeToStr(now()));
        // erroenvio(true);
        // raise;
      end;

    end;
    application.ProcessMessages;
    application.Restore;
    //
    try
      lbMensagemSplass.Caption := 'Gerando - NFCe nº: ' + NumNFe;
      application.ProcessMessages;

      ACBrNFe1.NotasFiscais.GerarNFe;
      Form_Login.LogVenda
        ('[Fechamento de Venda](GerarNFCe) ACBrNFe1.NotasFiscais.GerarNFe; ' +
        DateTimeToStr(now()));
      lbMensagemSplass.Caption := 'NFCe nº: ' + NumNFe + ' - Gerada';
      application.ProcessMessages;
    except
      on e: exception do
      begin
        MessageDlg('Clique [OK] - Atenção..' + #13'Erro ao enviar na SEFAZ ' +
          e.Message, mterror, [mbOk], 0);
        Form_Login.LogVenda('[Fechamento de Venda](GerarNFCe) Erro ao Validar; '
          + DateTimeToStr(now()));
        // erroenvio(true);
        // raise;
      end;

    end;
    application.ProcessMessages;
    application.Restore;

  end;

end;
