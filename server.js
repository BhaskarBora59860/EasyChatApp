const express = require("express");
const path = require("path");
const http = require("http");
const app = express();
const socketio = require("socket.io");
const CryptoJS = require("crypto-js");
const formatMessage = require("./utils/messages");
const {
  joinUser,
  getCurrentUser,
  userLeaveChat,
  roomUsers,
} = require("./utils/users");

const server = http.createServer(app);

//set up socket.io
const io = socketio(server);

const PORT = process.env.PORT || 5000;

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/index.html"));
});

app.get("/chatroom", (req, res) => {
  res.sendFile(path.join(__dirname + "/public" + "/chatroom.html"));
});

//run socket.io when client connects
const botName = "HeyoBot";
io.on("connection", (socket) => {
  socket.on("joinRoom", ({ userName, room }) => {
    const user = joinUser(socket.id, userName, room);

    socket.join(user.room);
    //welcome current user
    socket.emit(
      "message",
      formatMessage(botName, `${user.username}, welcome to ${user.room}!`)
    );

    //broadcast when a user connect
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    //send users and room info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: roomUsers(user.room),
    });
  });

  //listen to chatMessage from client
  socket.on("chatMessage", (encryptedMessage) => {
    const user = getCurrentUser(socket.id);
    const decryptedMessage = decryptMessage(encryptedMessage);
    io.to(user.room).emit("message", formatMessage(`${user.username}`, decryptedMessage));
  });

  //listen when a user is typing
  socket.on("typing", (typing) => {
    const user = getCurrentUser(socket.id);
    io.to(user.room).emit("message", formatMessage(`${user.username}`, typing));
  });

  //run when a client disconnect
  socket.on("disconnect", () => {
    const user = userLeaveChat(socket.id);
    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat`)
      );

      //send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: roomUsers(user.room),
      });
    }
  });
});

server.listen(PORT, () => console.log(`server running at port ${PORT}`));