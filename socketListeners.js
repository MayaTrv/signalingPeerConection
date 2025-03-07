
// on connection get all available offers and call createOfferEls
socket.on('availableOffers', offers=>{
    console.log(offers);
    createOfferEls(offers)
})

// someone just made a new offer and we're already here - call createOfferEls
socket.on('newOfferAwaiting', offers=>{
    createOfferEls(offers)
})

socket.on('answerResponse', offerObj=>{
    console.log(offerObj)
    addAnswer(offerObj)
})

socket.on('receivedIceCandidateFromServer', iceCandidate=>{
    addNewIceCandidate(iceCandidate)
    console.log(iceCandidate)
})

function createOfferEls(offers){
    // fazendo um botao de resposta (answer) verde para essa nova oferta (offer)
    // Não importa quantas ofertas existam, criaremos um novo elemento para cada uma. Adicionaremos o botão e o anexaremos.
    // Isso ocorrerá tanto se o cliente acabou de aparecer quanto se já estava aqui e a oferta simplesmente apareceu.
    const answerEl = document.querySelector('#answer');
    offers.forEach(o=>{
        console.log(o);
        const newOfferEl = document.createElement('div');
        newOfferEl.innerHTML = `<button class="btn btn-success col-1">Answer ${o.offererUserName}</button>`
        newOfferEl.addEventListener('click',()=>answerOffer(o))
        answerEl.appendChild(newOfferEl);
    })
}