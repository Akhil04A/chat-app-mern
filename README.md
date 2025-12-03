# Real-Time Chat Application - MERN Stack

A full-stack real-time chat application built with MongoDB, Express, React, and Node.js, featuring Socket.io for instant messaging.

## Features

- 🔐 User authentication (Register/Login)
- 💬 Real-time messaging with Socket.io
- 👥 User list with online/offline status
- ⌨️ Typing indicators
- 💾 Message history stored in MongoDB
- 🎨 Modern and responsive UI
- 🔒 JWT-based authentication

## Tech Stack

### Backend
- Node.js & Express.js
- MongoDB with Mongoose
- Socket.io for real-time communication
- JWT for authentication
- bcryptjs for password hashing

### Frontend
- React 18
- React Router for navigation
- Socket.io Client
- Axios for API calls
- Vite for build tooling

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v16 or higher)
- MongoDB (local installation or MongoDB Atlas account)
- npm or yarn

## Installation & Setup

### 1. Clone the repository
```bash
cd chatis
```

### 2. Backend Setup

```bash
cd server
npm install
```

Create a `.env` file in the `server` directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chatis
JWT_SECRET=your_jwt_secret_key_here_change_in_production
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

### 3. Frontend Setup

```bash
cd ../client
npm install
```

### 4. Start MongoDB

Make sure MongoDB is running on your system:
```bash
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl start mongod
# or
mongod
```

Or use MongoDB Atlas and update the `MONGODB_URI` in your `.env` file.

### 5. Run the Application

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

The backend will run on `http://localhost:5000` and the frontend on `http://localhost:5173`.

## Usage

1. Open your browser and navigate to `http://localhost:5173`
2. Register a new account or login with existing credentials
3. Select a user from the sidebar to start chatting
4. Start sending messages in real-time!

## Project Structure

```
chatis/
├── server/
│   ├── models/
│   │   ├── User.js
│   │   └── Message.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── messageRoutes.js
│   ├── socket/
│   │   └── socketHandler.js
│   ├── middleware/
│   │   └── auth.js
│   ├── server.js
│   └── package.json
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── Chat.jsx
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `GET /api/auth/users` - Get all users

### Messages
- `GET /api/messages/:userId` - Get messages between current user and specified user
- `PUT /api/messages/read/:userId` - Mark messages as read

## Socket Events

### Client → Server
- `message:send` - Send a message
- `typing:start` - Start typing indicator
- `typing:stop` - Stop typing indicator

### Server → Client
- `message:receive` - Receive a new message
- `message:sent` - Confirm message was sent
- `users:online` - Update online users list
- `typing:start` - Someone is typing
- `typing:stop` - Someone stopped typing

## Environment Variables

Make sure to update the JWT_SECRET in production with a strong random string.

## Troubleshooting

1. **MongoDB connection error**: Ensure MongoDB is running and the connection string is correct
2. **Port already in use**: Change the PORT in `.env` file or kill the process using that port
3. **CORS errors**: Ensure CLIENT_URL in `.env` matches your frontend URL
4. **Socket connection failed**: Check that the backend is running and the URL is correct

## License

ISC

## Contributing

Feel free to fork, modify, and use this project for your own purposes.

