// WebRTC service helper for 2-way VoIP voice and video calls (Premium Feature)
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices } from 'react-native-webrtc';

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

class WebRTCService {
  localStream = null;
  remoteStream = null;
  peerConnection = null;

  async startLocalStream(enableVideo = false) {
    try {
      const constraints = {
        audio: true,
        video: enableVideo ? { facingMode: 'user' } : false
      };
      
      this.localStream = await mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (e) {
      console.error('Failed to access microphone/camera', e);
      throw e;
    }
  }

  async initiateCall(targetDeviceId, enableVideo = false, onRemoteStream) {
    try {
      await this.startLocalStream(enableVideo);
      
      this.peerConnection = new RTCPeerConnection(iceServers);
      
      // Add local tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Send ICE candidate to peer via signaling server (Socket.io)
          console.log('Sending ICE Candidate:', event.candidate);
        }
      };

      // Handle remote stream tracks
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        if (onRemoteStream) {
          onRemoteStream(this.remoteStream);
        }
      };

      // Create Offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      // In production: send offer to device via WebSocket signaling
      console.log('Created SDP Offer:', offer);
      return offer;
    } catch (err) {
      console.error('Error initiating WebRTC call', err);
      throw err;
    }
  }

  endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStream = null;
    console.log('WebRTC Call fully terminated.');
  }
}

const webrtcInstance = new WebRTCService();
export default webrtcInstance;
