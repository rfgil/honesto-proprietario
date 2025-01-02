const getRecibos = () => fetch(
  'https://imoveis.portaldasfinancas.gov.pt/arrendamento/api/obterRecibos/emitente',
  {
    headers: new Headers({
      "Accept": "application/json, text/javascript, */*; q=0.01",
    })
  }
).then((response) => response.json());

const fetchEmitirRecibo = (data) => fetch(
  'https://imoveis.portaldasfinancas.gov.pt/arrendamento/api/emitirRecibo',
  {
    method: 'POST',
    body: JSON.stringify(data),
    headers: new Headers({
      "Accept": "application/json, text/plain",
      "Referer": `https://imoveis.portaldasfinancas.gov.pt/arrendamento/criarRecibo/${data.numContrato}`,
      "Content-Type": "application/json;charset=UTF-8",
    })
  }
);

const fetchContrato = (contratoId) => fetch(
  `https://imoveis.portaldasfinancas.gov.pt/arrendamento/criarRecibo/${contratoId}`,
  {
    headers: new Headers({
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-"
    })
  }
).then((response) => response.text())
  .then((html) => {
    const doc = (new DOMParser()).parseFromString(html, "text/html")
    const script = Array.from(doc.querySelectorAll("script:not([src])"))[1]
    return JSON.parse(script.innerText.match(/\$scope\.recibo = ({.*);$/m)[1])
  })

const downloadFile = async (url, filename) => fetch(url)
  .then(response => response.blob())
  .then(blob => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  })
  .catch(e => console.error('Error downloading file:', e));

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

const firstDayOfNextMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 1)

const lastDayOfMonth = (date) => {
  const result = firstDayOfNextMonth(date);
  result.setDate(result.getDate() - 1);
  return result;
}

const emitirRecibo = async (lastRecibo, contratoId) => {
  const dataInicio = firstDayOfNextMonth(new Date(lastRecibo.dataInicio));
  const dataFim = lastDayOfMonth(dataInicio);

  if (dataInicio > Date.now()) {
    alert("Já foi emitido o recibo para o mês atual.");
    return;
  }

  const contrato = await fetchContrato(contratoId)
  const payload = {
    ...contrato,
    herdeiros: [],
    valor: lastRecibo.importancia,
    dataInicio: formatDate(dataInicio),
    dataFim: formatDate(dataFim),
    dataRecebimento: formatDate(dataInicio),
    tipoImportancia: {
      codigo: "RENDAC",
      label: "Renda"
    },
  }

  const locatarios = payload.locatarios.map((l) => l.nome.split(' ')[0].trim()).join('_');
  const pdfUrl = `../imprimirRecibo/${contratoId}/${lastRecibo.numeroRecibo + 1}`
  const pdfName = `${dataInicio.getFullYear()}_${dataInicio.getMonth() + 1}_${locatarios}.pdf`

  const confirmMessage = `Valor: ${payload.valor}€
Datas: ${payload.dataInicio} -> ${payload.dataFim}
Nº Recibo: ${lastRecibo.numeroRecibo + 1}
Referência: ${pdfName}`

  if (!confirm(confirmMessage)) return;

  fetchEmitirRecibo(payload)
    .then(() => downloadFile(pdfUrl, pdfName))
    .then(() => window.open(pdfUrl, '_blank'));
}

const handleAction = async (contratoId) => {
  const recibos = await getRecibos();

  const lastRecibo = recibos
    .filter((recibo) => recibo.numeroContrato === contratoId)
    .reduce((max, obj) => (obj.numeroRecibo > max.numeroRecibo ? obj : max), recibos[0]);

  emitirRecibo(lastRecibo, contratoId);
}

const injectAction = async () => {
  document.querySelectorAll('#tabelaDados > tbody > tr')
    .forEach((el) => {
      const regex = /arrendamento\/detalheContrato\/(\d+)/
      const contratoId = parseInt(regex.exec(el.querySelector('td').getAttribute("onclick"))[1]);

      const actionMenu = el.querySelector('ul')
      if (!actionMenu) return;

      const newAction = document.createElement("li")
      newAction.innerHTML = "<a>Emitir próximo recibo</a>"
      newAction.addEventListener('click', () => handleAction(contratoId))
      actionMenu.appendChild(newAction)
    });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.text === "OBTER_CONTRATOS_FINISHED") injectAction()
});
