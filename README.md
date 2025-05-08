# Yuhu Chat App



## 📱 Overview

Yuhu is a vibrant, user-friendly chat application designed specifically for college students. Our mission is to create a seamless communication platform that enhances the college experience by connecting students with their friends and classmates in a fun, intuitive environment.

**Tagline:** "Shout out to your crew!"

## ✨ Features

### Core Communication
- **Private Messaging** - Smooth one-on-one conversations with friends
- **Group Chats** - Create custom groups for classes, clubs, study sessions, and more
- **Rich Media Sharing** - Easily share photos, videos, documents, and voice messages
- **Read Receipts** - Know when your messages have been seen

### College-Specific Features
- **Study Mode** - Set timed chat sessions that automatically disable notifications
- **Class Groups** - Dedicated spaces for course discussions and materials
- **Poll Creator** - Quick decision-making for group activities or study sessions
- **File Exchange** - Share notes, assignments, and study materials with classmates

### Unique "Lovable" Features
- **Bump Feature** - Shake your phone to "bump" a conversation to the top of a friend's chat list
- **Wave Button** - Quick way to say hi without typing a message
- **Mood Music** - Share what you're listening to with a single tap
- **Status Updates** - Let friends know if you're studying, free to hang, or busy
- **Custom Themes** - Personalize your chat experience with various color schemes

## 🚀 Getting Started

### Prerequisites
- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)
- Firebase account
- React Native environment setup

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/yuhu-chat.git
   cd yuhu-chat
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure Firebase
   - Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Enable Authentication, Firestore, and Storage
   - Add your Firebase configuration to `src/config/firebase.js`

4. Start the development server
   ```bash
   npm start
   ```

5. Run on a device or emulator
   ```bash
   # For iOS
   npm run ios
   
   # For Android
   npm run android
   ```

## 🧱 Project Structure

```
yuhu-chat/
├── assets/                  # Images, fonts, and other static files
├── src/
│   ├── components/          # Reusable UI components
│   ├── config/              # Configuration files
│   ├── context/             # React context providers
│   ├── hooks/               # Custom React hooks
│   ├── navigation/          # Navigation configuration
│   ├── screens/             # Application screens
│   ├── services/            # API and service logic
│   ├── utils/               # Utility functions
│   └── App.js               # Main application component
├── .gitignore
├── app.json
├── babel.config.js
├── package.json
└── README.md
```

## 💻 Technology Stack

- **Frontend**: React Native
- **State Management**: React Context API
- **Backend**: Firebase
  - Authentication
  - Firestore (database)
  - Cloud Storage
  - Cloud Functions
- **Notifications**: Firebase Cloud Messaging

## 📝 Development Roadmap

### Phase 1: MVP (Minimum Viable Product)
- User authentication
- Basic profile setup
- Private messaging
- Simple friend management

### Phase 2: Core Features
- Group chat functionality
- Media sharing capabilities
- Enhanced profile customization
- Basic notifications

### Phase 3: College-Specific Features
- Study mode implementation
- Class groups and file sharing
- Poll creator
- Status updates

### Phase 4: Polish & Unique Features
- UI refinements and animations
- Bump feature and wave button
- Custom themes
- Mood music sharing

## 🧪 Testing

- **Unit Tests**: Jest
- **Integration Tests**: React Native Testing Library
- **E2E Tests**: Detox
- **User Testing**: Conducted with college student focus groups

Run tests with:
```bash
npm test
```

## 🤝 Contributing

We welcome contributions from fellow students! If you'd like to contribute:

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows our coding standards and includes appropriate tests.

## 📞 Contact

For questions or feedback about the project:
- Email: indiralaabhinavchary@gmail.com
- GitHub Issues: [https://github.com/yourusername](https://github.com/Abhinav0406)

---

*Yuhu Chat App - Connecting college students, one message at a time*
