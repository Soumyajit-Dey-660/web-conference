// DOM elements.
const roomSelectionContainer = document.getElementById(
  "room-selection-container"
);
const shareScreenButton = document.getElementById("share-screen");
const roomInput = document.getElementById("room-input");
const joinButton = document.getElementById("join-button");
const createButton = document.getElementById("create-button");
const videoChatContainer = document.getElementById("video-chat-container");
const localVideoComponent = document.getElementById("local-video");
const remoteVideoComponent = document.getElementById("remote-video");
const screenVideoComponent = document.getElementById("local-screen-video");
const localVideoText = document.getElementById("local-video-text");
const remoteVideoText = document.getElementById("remote-video-text");

// shareScreenButton.style = "display:none";
$('#share-screen').hide(); 

// Variables.
const socket = io();
const mediaConstraints = { 
  audio: true,
  video: { width: 400, height: 300 },
};
let localStream;
let localScreenStream;
let remoteStream;
let remoteScreenStream;
let isRoomCreator;
let rtcPeerConnection; // Connection between the local device and the remote peer.
let roomId;

// Free public STUN servers provided by Google.
const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

// BUTTON LISTENER ============================================================
shareScreenButton.addEventListener('click', () => {
  shareScreen(mediaConstraints);
})

joinButton.addEventListener("click", () => {
  joinRoom(roomInput.value);
});

createButton.addEventListener("click", () => {
  createRoom(roomInput.value);
});

// SOCKET EVENT CALLBACKS =====================================================
socket.on("room_created", async () => {
  console.log("Socket event callback: room_created");
  await setLocalStream(mediaConstraints, 1);
  isRoomCreator = true;
});

socket.on("room_joined", async () => {
  console.log("Socket event callback: room_joined");
  await setLocalStream(mediaConstraints, 0);
  socket.emit("start_call", roomId);
});

socket.on("full_room", () => {
  console.log("Socket event callback: full_room");
  alert("The room is full, please try another one");
});

// FUNCTIONS ==================================================================
function joinRoom(room) {
  if (room === "") {
    alert("Please type a room ID");
  } else {
    roomId = room;
    socket.emit("join", room);
    showVideoConference();
  }
}

function createRoom(room) {
  if (room === "") {
    alert("Please type a room ID");
  } else {
    roomId = room;
    socket.emit("create", room);
    showVideoConference();
  }
} 

shareScreen = async mediaConstraints => {
  console.log('SHARE SCREEN BUTTON CLICKED');
  await setLocalScreenStream(mediaConstraints, 1);
}

function showVideoConference() {
  roomSelectionContainer.style = "display:none";
  videoChatContainer.style = "display:block";
  shareScreenButton.style = "display:block";
  // $('share-screen').show();
}

async function setLocalStream(mediaConstraints, flag) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
  } catch (error) {
    console.error("Could not get user media", error);
  }
  flag ? localVideoText.innerText = "HOST" : remoteVideoText.innerText = "REMOTE";
  localStream = stream;
  localVideoComponent.srcObject = stream;
}

async function setLocalScreenStream(mediaConstraints) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia(mediaConstraints);
  } catch (error) {
    console.log("Could not get Scrren media", error);
  }
  localScreenStream = stream;
  screenVideoComponent.srcObject = stream;
  socket.emit("start_screen_share", roomId);
}

// SOCKET EVENT CALLBACKS =====================================================
socket.on('start_call', async () => {
  console.log('Socket event callback: start_call')
  if (isRoomCreator) {
    rtcPeerConnection = new RTCPeerConnection(iceServers)
    addLocalTracks(rtcPeerConnection)
    rtcPeerConnection.ontrack = setRemoteStream
    rtcPeerConnection.onicecandidate = sendIceCandidate
    await createOffer(rtcPeerConnection)
  }
})

socket.on('start_screen_share', async () => {
  console.log('Socket Event callback: start_screen_share')
  if (isRoomCreator) {
    rtcPeerConnection = new RTCPeerConnection(iceServers)
    addLocalScreenTracks(rtcPeerConnection)
    // rtcPeerConnection.ontrack = setRemoteScreenStream
    rtcPeerConnection.onicecandidate = sendIceCandidate
    await createOffer(rtcPeerConnection)
  }
})

socket.on('webrtc_offer', async (event) => {
  console.log('Socket event callback: webrtc_offer')

  if (!isRoomCreator) {
    rtcPeerConnection = new RTCPeerConnection(iceServers)
    addLocalTracks(rtcPeerConnection)
    rtcPeerConnection.ontrack = setRemoteStream
    rtcPeerConnection.onicecandidate = sendIceCandidate
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event))
    await createAnswer(rtcPeerConnection)
  }
})

socket.on('webrtc_answer', (event) => {
  console.log('Socket event callback: webrtc_answer')

  rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event))
})

socket.on('webrtc_ice_candidate', (event) => {
  console.log('Socket event callback: webrtc_ice_candidate')

  // ICE candidate configuration.
  var candidate = new RTCIceCandidate({
    sdpMLineIndex: event.label,
    candidate: event.candidate,
  })
  rtcPeerConnection.addIceCandidate(candidate)
})

// FUNCTIONS ==================================================================
function addLocalTracks(rtcPeerConnection) {
  localStream.getTracks().forEach((track) => {
    rtcPeerConnection.addTrack(track, localStream)
  })
}

function addLocalScreenTracks(rtcPeerConnection) {
  localScreenStream.getTracks().forEach((track) => {
    rtcPeerConnection.addTrack(track, localScreenStream)
  })
}

async function createOffer(rtcPeerConnection) {
  let sessionDescription
  try {
    sessionDescription = await rtcPeerConnection.createOffer()
    rtcPeerConnection.setLocalDescription(sessionDescription)
  } catch (error) {
    console.error(error)
  }

  socket.emit('webrtc_offer', {
    type: 'webrtc_offer',
    sdp: sessionDescription,
    roomId,
  })
}

async function createAnswer(rtcPeerConnection) {
  let sessionDescription
  try {
    sessionDescription = await rtcPeerConnection.createAnswer()
    rtcPeerConnection.setLocalDescription(sessionDescription)
  } catch (error) {
    console.error(error)
  }

  socket.emit('webrtc_answer', {
    type: 'webrtc_answer',
    sdp: sessionDescription,
    roomId,
  })
}

function setRemoteStream(event) {
  remoteVideoComponent.srcObject = event.streams[0]
  remoteStream = event.stream
}

function setRemoteScreenStream(event) {
  remoteVideoComponent.srcObject = event.streams[1]
  remoteStream = event.stream
}

function sendIceCandidate(event) {
  if (event.candidate) {
    socket.emit('webrtc_ice_candidate', {
      roomId,
      label: event.candidate.sdpMLineIndex,
      candidate: event.candidate.candidate,
    })
  }
}
