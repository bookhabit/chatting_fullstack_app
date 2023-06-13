const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./models/Users')
const Message = require('./models/Message')
const bcrypt = require('bcryptjs');
const ws = require('ws');
const fs = require('fs');

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({credentials:true,origin:'http://localhost:5173'}));

async function getUserDataFromRequest(req) {
  return new Promise((resolve, reject) => {
    const token = req.cookies?.token;
    if (token) {
      jwt.verify(token, jwtSecret, {}, (err, userData) => {
        if (err) throw err;
        resolve(userData);
      });
    } else {
      reject('no token');
    }
  });

}

app.get('/test', (req,res) => {
    res.json('test ok2');
});

// 채팅방 api
app.get('/messages/:userId',async (req,res)=>{
  mongoose.connect(process.env.MONGO_URL)
  const {userId} = req.params;
  const userData = await getUserDataFromRequest(req);
  const ourUserId = userData.userId;
  const messages = await Message.find({
    sender:{$in:[userId,ourUserId]},
    recipient:{$in:[userId,ourUserId]},
  }).sort({createdAt:1}).exec();
  res.json(messages)
})

// 오프라인 유저 찾기
app.get('/people',async (req,res)=>{
  mongoose.connect(process.env.MONGO_URL)
  const users = await User.find({},{'_id':1,username:1});
  res.json(users);
})

// 인증

app.get('/profile', (req,res) => {
    const token = req.cookies?.token;
    if (token) {
      jwt.verify(token, jwtSecret, {}, (err, userData) => {
        if (err) throw err;
        res.json(userData);
      });
    } else {
      res.status(401).json('no token');
    }
  });

app.post('/login', async (req,res) => {
    mongoose.connect(process.env.MONGO_URL)
    const {username, password} = req.body;
    const foundUser = await User.findOne({username});
    if (foundUser) {
      const passOk = bcrypt.compareSync(password, foundUser.password);
      if (passOk) {
        jwt.sign({userId:foundUser._id,username}, jwtSecret, {}, (err, token) => {
          res.cookie('token', token, {sameSite:'none', secure:true}).json({
            id: foundUser._id,
          });
        });
      }
    }
  });
  
  app.post('/logout', (req,res) => {
    res.cookie('token', '', {sameSite:'none', secure:true}).json('ok');
  });
  
  app.post('/register', async (req,res) => {
    mongoose.connect(process.env.MONGO_URL)
    const {username,password} = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
      const createdUser = await User.create({
        username:username,
        password:hashedPassword,
      });
      jwt.sign({userId:createdUser._id,username}, jwtSecret, {}, (err, token) => {
        if (err) throw err;
        res.cookie('token', token, {sameSite:'none', secure:true}).status(201).json({
          id: createdUser._id,
        });
      });
    } catch(err) {
      if (err) throw err;
      res.status(500).json('error');
    }
  });

const server = app.listen(4000)

// 웹소켓
const wsServer = new ws.WebSocketServer({server});
wsServer.on('connection',(connection,req)=>{

  // read username and id from the cookie for this connection
  const cookies = req.headers.cookie;
  if(cookies){
    const tokenCookieString =  cookies.split(';').find(str=>str.startsWith('token='));
    if(tokenCookieString){
      const token = tokenCookieString.split('=')[1];
      if(token){
        jwt.verify(token,jwtSecret,{},(err,userData)=>{   
          if(err) throw err;
          const {userId,username} = userData;
          connection.userId = userId;
          connection.username = username;
        })
      }
    }
  }

  // 
  connection.on('message',async (message,isBinary)=>{
    mongoose.connect(process.env.MONGO_URL)
    const messageData = JSON.parse(message.toString());
    console.log('messageData',messageData)
    const {recipient,text} = messageData.message;
    if(recipient&&text){
      const messageDoc = await Message.create({
        sender:connection.userId,
        recipient,
        text,
      });

      [...wsServer.clients]
      .filter(c => c.userId === recipient)
      .forEach(c => c.send(JSON.stringify({
        text,
        sender:connection.userId,
        recipient,
        _id:messageDoc._id,
      })));
    }
  });

  // notify everyone about online people
  [...wsServer.clients].forEach(client=>{
    client.send(JSON.stringify({
      online:[...wsServer.clients].map(c=>({userId:c.userId,username:c.username}))
    }))
  })
})