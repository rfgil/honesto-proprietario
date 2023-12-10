const handleWebRequest = async (request) => {
  chrome.tabs.sendMessage(request.tabId, { text: "OBTER_CONTRATOS_FINISHED" })
}

chrome.webRequest.onCompleted.addListener(
  handleWebRequest,
  { urls: ['https://imoveis.portaldasfinancas.gov.pt/arrendamento/api/obterContratos/locador?_=*'] }
);

