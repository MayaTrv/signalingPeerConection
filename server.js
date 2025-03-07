const fs = require('fs');
const https = require('https');

const express = require('express');
// aqui fazer no terminal 'npm init y' e 'npm install express'

const app = express();

const socketio = require('socket.io');

app.use(express.static(__dirname))

const key = fs.readFileSync('create-cert-key.pem');
const cert = fs.readFileSync('create-cert.pem');

// Alteramos nossa configuração expressa para podermos usar HTTPS. Antes: app.listen(8181)
// A chave e o certificado sao necessarios para criar o servidor no HTTPS
const expressServer = https.createServer({key, cert}, app); // Então nosso aplicativo é nosso aplicativo expresso. Criamos nosso servidor expresso, 
// usamos HTTPS para isso e entregamos a ele nosso aplicativo Express.
// Cria o servidor Socket.io.
const io = socketio(expressServer);

expressServer.listen(8181);

// offers irao conter objetos {}
const offers = [
    // offererUserName
    // offer
    // offerIceCandidates
    // answererUserName
    // answer
    // answererIceCandidates
];

const connectedSockets = [
    // username, socketID
]

io.on('connection',(socket)=>{
    // console.log("Someone has connected");

    // handshake eh por onde os dados de consulta e autenticacao sao transmitidos
    const userName = socket.handshake.auth.userName
    const password = socket.handshake.auth.password

    if(password !== "x"){
        socket.disconnect(true);
        return;
    }
    connectedSockets.push({
        socketId: socket.id,
        userName
    })

    // Iniciando 10.) Um novo cliente entrou. Se tiver alguma oferta disponivel, envie-a
    if(offers.length){
        socket.emit('availableOffers', offers);
    }

    // A seguir, as ofertar serão passadas, que é o que o servidor de sinalização está usando apenas para manter o controle  de todas as ofertas que estão na mesa.
    socket.on('newOffer', newOffer=>{
        // eh necessario manter todas as ofertas que chegam, quem esta conectado, se temos candidatos ICE, etc.
        offers.push({
            offererUserName: userName,
            offer: newOffer,
            offerIceCandidates: [],
            answererUserName: null,
            answer: null,
            answererIceCandidates: []
        })
        // console.log(newOffer.sdp.slice(50)) // aqui será o STP quando ele chegar por meio de uma nova oferta

        // Feito isso, vamos enviar para todos os sockets conectados, EXCETO o caller
        // (-1) pois estamos enviando a oferta mais recente da matriz
        socket.broadcast.emit('newOfferAwaiting', offers.slice(-1))
        
    })

    socket.on('newAnswer', (offerObj, ackFunction)=>{
        console.log(offerObj);        
        // Emita esta resposta (offerObj) de volta para o CLIENT1
        // Para fazer isso, precisamos do socketid do CLIENT1 
        const socketToAnswer = connectedSockets.find(s=>s.userName === offerObj.offererUserName)
        if(!socketToAnswer){
            console.log("No matching socket")
            return;
        }
        // caso contrario, encontramos o socket correspondente para que possamos emitir para ele
        const socketIdToAnswer = socketToAnswer.socketId;

        // agora precisamos encontrar a oferta a ser atualizada para o qual vamos emitir
        const offerToUpdate = offers.find(o=>o.offererUserName === offerObj.offererUserName)
        if(!offerToUpdate){
            console.log('No OfferToUpdate')
            return;
        }

        // Caso contrário, faremos a função de reconhecimento e enviaremos de volta a oferta para atualização .offerIceCandidates
        // Ou seja, Envia de volta ao respondente todos os candidatos ICE que já foram coletados.
        ackFunction(offerToUpdate.offerIceCandidates);

        offerToUpdate.answer = offerObj.answer
        // variável local atualizada, local para a oferta do servidor para envio.
        offerToUpdate.answererUserName = userName

        // o Socket.io tem .to() que permite emitir para uma sala "room". Cada Socket tem seu próprio espaço "room" .
        socket.to(socketIdToAnswer).emit('answerResponse',offerToUpdate)

    })

    socket.on('sendIceCandidateToSignalingServer', iceCandidateObj=>{
        const { didIOffer, iceUserName, iceCandidate } = iceCandidateObj;
        // console.log(iceCandidate); // aqui sera impresso o candidato ICE, que é candidato do outro lado.
        if(didIOffer){
            // this ICE is coming from the offerer. Send to the answerer

            // Se eu sou a oferta, isto eh, a pessoa que enviou isso e este é meu nome (iceUserName), 
            // procure na lista de ofertas aquela oferta específica (o=>o.offererUserName === iceUserName)
            const offerInOffers = offers.find(o=>o.offererUserName === iceUserName);

            if(offerInOffers){
                offerInOffers.offerIceCandidates.push(iceCandidate)
                // 1. Quando a resposta é dada, todos os candidatos ICE existentes são enviados.
                // 2. Todos os candidatos que vierem depois que a oferta (offer) já foi respondida, será repassada.
                if(offerInOffers.answererUserName){
                    // Se já houver um nome de usuário de resposta, podemos passá-lo para o outro socket.
                    const socketToSendTo = connectedSockets.find(s=>s.userName === offerInOffers.answererUserName);
                    if(socketToSendTo){
                        socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate)
                    }
                    else{
                        // Este candidato ICE recebeu, mas nao conseguiu encontrar a resposta
                        console.log("ICE candidate recieved but could not find ANSWERER")
                    }

                }
            }
        }
        else{
            // this ICE is coming from the answerer. Send to the offerer
            // pass it through to the other socket
            const offerInOffers = offers.find(o=>o.answererUserName === iceUserName);
            const socketToSendTo = connectedSockets.find(s=>s.userName === offerInOffers.offererUserName);
            if(socketToSendTo){
                socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate)
            }
            else{
                // Este candidato ICE recebeu, mas nao conseguiu encontrar a resposta
                console.log("ICE candidate recieved but could not find OFFERER")
            }
        }
        // visualizando as ofertas disponiveis
        // console.log(offers);
    })
})

// app.listen(8181) 
// Você pode colocar qualquer porta que quiser lá. Acontece que esse está aberto no momento. 
// escrever o comando no terminal: 'nodemon server.js'
// testar http://localhost:8181/index.html


// precisamos instalar 'npm install socket.io' no terminal

// para criar nosso servidor HTTPS: 'npm install mkcert'
// mkcert: Essa coisa criará certificados autoassinados sem Open SSL, caso as pessoas estejam em máquinas Windows mais antigas, por ex.

// depois mkcert create-ca
// It will expire on 3 June 2027 🗓

// depois mkcert create-ca
// It will expire on 3 June 2027 🗓

// Agora temos uma chave pública, um certificado, uma chave privada, etc.
