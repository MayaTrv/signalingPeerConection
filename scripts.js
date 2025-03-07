const userName = "May-"+Math.floor(Math.random()*100000)
const password = "x";
document.querySelector('#user-name').innerHTML = userName

// para abrir no celular colocar o IP de candidato no lugar do localhost
// const socket = io.connect('https://localhost:8181/', {
//     auth: {
//         userName, password
//     }
// })

const socket = io.connect('https://192.168.15.63:8181/', {
    auth: {
        userName, password
    }
})

const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');

// Variaveis

let localStream; // a var to hold the local video stream
let remoteStream; // a var to hold the remote video stream
let peerConnection; // the peerConnection that the two clients use to talk
let didIOffer = false;

// fazendo a configuracao do peer 

let peerConfiguration = {
    iceServers:[
        {
            urls:[
                // Olá, tenho alguns servidores de atordoamento para você. Então, quando chegar a hora, 
                // quando você estiver pronto para começar a descobrir como chegar até mim, pergunte ao stunnel google.com 
                // na porta 19 302 e então como segunda opção, atordoe um ponto l ponto Google.
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302'
            ]
        }
    ]
}


// quando um cliente inicia uma chamada
const call = async e=>{

    await fetchUserMedia();

    // A conexão entre pares está pronta com nossos servidores STUN enviados.
    await createPeerConnection();
    // os dois computadores precisarao disso


    // create offer time
    // O método CreateOffer inicia a criação de uma oferta SDP com o objetivo de iniciar um novo site Conexão RTC com um peer remoto.
    try{
        console.log('Creating Offer')
        const offer = await peerConnection.createOffer();
        console.log(offer);
        peerConnection.setLocalDescription(offer); // com isso eh possivel visualizar os candidatos abertos, o endereco IP de cada um, numero de porta

        didIOffer = true;

        // emitindo uma nova oferta
        socket.emit('newOffer', offer) // envia uma oferta para o servidor de sinalizacao

    }catch(err){
        console.log(err)
    }


}

const answerOffer = async(offerObj)=>{
    // apos clicar no botao verde, sera possivel visualizar o objeto offer com o type e o SDP
    await fetchUserMedia()
    // criamos uma peerConnection
    await createPeerConnection(offerObj);
    // Criamos uma resposta
    const answer = await peerConnection.createAnswer({}); // colocando {} so porque esta no docs, mas nao serve pra nada
    // Definimos essa resposta como a descrição local dessa conexão de pares.
    await peerConnection.setLocalDescription(answer); // this is CLIENT2, and CLIENT2 uses the answer as the localDescription
    console.log(offerObj)
    console.log(answer)

    // Adicionando a resposta (answer) ao objeto de oferta (offerObj) para que o servidor saiba a qual oferta isso está relacionado.
    offerObj.answer= answer
    // Agora esta pronto para envia-la (a resposta) para o servidor
    // Portanto: Emita a resposta para o servidor de sinalizacao para que ele possa emitir para o CLIENT1
    // Aguarde uma resposta do servidor com os candidatos ICE já existentes.
    const offerIceCandidates = await socket.emitWithAck('newAnswer', offerObj)
    offerIceCandidates.forEach(c=>{
        peerConnection.addIceCandidate(c);
        console.log("==== Added ICE Candidate====")
    })
    console.log(offerIceCandidates)

}

const addAnswer = async(offerObj)=>{
    //addAnswer is called in socketListeners when an answerResponse is emitted.
    //at this point, the offer and answer have been exchanged (trocadas)!
    //now CLIENT1 needs to set the remote description
    await peerConnection.setRemoteDescription(offerObj.answer);
    // console.log(peerConnection.signalingState)
    console.log('oi')
}

const fetchUserMedia = ()=>{
    return new Promise(async(resolve, reject)=>{
        try{
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                // audio: true,
            });
            localVideoEl.srcObject = stream;
        
            // ATE AQUI, OBTEMOS A MIDIA DO USUARIO E CARREGAMOS
        
            localStream = stream;
            resolve();
        }catch(err){
            console.log(err);
            reject()
        }
    })
}

const createPeerConnection = (offerObj)=>{
    return new Promise(async(resolve, reject)=>{
        // A conexão de pares RTC é o que cria a conexão (RTCPeerConnection)
        // Podemos passar um objeto de configuração.
        // E esse objeto de configuração pode conter servidores de STUN que nos buscarão candidatos ICE.
        // Obs.: O ICE é um estabelecimento de conectividade interativa.
        
        peerConnection = new RTCPeerConnection(peerConfiguration)
        //peerConnection = new RTCPeerConnection(peerConnection) // Especificamente, "aqui estão alguns servidores STUN. 
        // Preciso que você descubra um caminho para que outra pessoa possa chegar até mim".
        remoteStream = new MediaStream()
        remoteVideoEl.srcObject = remoteStream;
        
        // Adiciona as tracks
        localStream.getTracks().forEach(track=>{
            // Adiciona local tracks entao elas podem ser enviadas uma vez que a conexao esta estavel
            peerConnection.addTrack(track, localStream);
        }) // associar o stream, que novamente substituímos o stream local aqui com nossa conexão de pares para que quando 
        // chamarmos a oferta de criação, ela possa realmente verificar o stream de dados para encontrar e descobrir quais 
        // informações o outro navegador precisará saber.

        peerConnection.addEventListener("signalingstatechange", (event) => {
            console.log(event);
            console.log(peerConnection.signalingState)
        });

        // Adiciona o ICE candidate a seguir
        peerConnection.addEventListener('icecandidate', e=>{
            console.log('ICE candidate found!')
            console.log(e)

            // emitindo os candidatos ICE até o servidor de sinalização - as vezes um candidado pode conter null, entao precisa especificar
            if(e.candidate){
                socket.emit('sendIceCandidateToSignalingServer',{
                    iceCandidate: e.candidate,
                    iceUserName: userName,
                    didIOffer,
                })
            }
        })

        peerConnection.addEventListener('track', e=>{
            console.log("Got a new track from other peer!")
            console.log(e)
            e.streams[0].getTracks().forEach(track=>{
                remoteStream.addTrack(track, remoteStream);
                console.log("Eh possivel visualizar o video do outro Cliente na Call")

            })
        })

        if(offerObj){
            // this won't be set when called from call()
            // this will be set when we call from (answerOffer())
            await peerConnection.setRemoteDescription(offerObj.offer)
        }
        resolve();
    })
}

const addNewIceCandidate = iceCandidate=>{
    peerConnection.addIceCandidate(iceCandidate)
    console.log('====Added ICE Candidate====')
}

// definicao do botao para inicar a chamada
document.querySelector('#call').addEventListener('click', call)