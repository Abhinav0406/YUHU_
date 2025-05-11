// ICE Server configuration for WebRTC
export const getIceServers = async () => {
  return [
    { urls: [ "stun:bn-turn1.xirsys.com" ] },
    {
      username: "4_-0meo9bpXxLKev-f5OtW7XWAk0NZ_m2G56CTUXktvH_pW0YIxlNTfuN4PaWmoSAAAAAGggfIVBbWJpY2E=",
      credential: "1c000836-2e53-11f0-814a-0242ac140004",
      urls: [
        "turn:bn-turn1.xirsys.com:80?transport=udp",
        "turn:bn-turn1.xirsys.com:3478?transport=udp",
        "turn:bn-turn1.xirsys.com:80?transport=tcp",
        "turn:bn-turn1.xirsys.com:3478?transport=tcp",
        "turns:bn-turn1.xirsys.com:443?transport=tcp",
        "turns:bn-turn1.xirsys.com:5349?transport=tcp"
      ]
    }
  ];
}; 