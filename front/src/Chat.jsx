import { useContext, useEffect, useRef, useState } from "react"
import Avatar from "./Avatar";
import Logo from "./Logo";
import { UserContext } from "./UserContext";
import {uniqBy} from "lodash"
import axios from "axios";
import ContackUserList from "./ContactUserList";

export default function Chat(){
    const [ws,setWs] = useState(null);
    const [onlinePeople,setOnlinePeople] = useState({})
    const [offlinePeople,setOfflinePeople] = useState({});
    const [selectedUserId,setSelectedUserId] = useState(null)
    const [newMessageText,setNewMessageText] = useState('')
    const [messages,setMessages] = useState([]);
    const {username,id} = useContext(UserContext);
    const divUnderMessages = useRef();

    useEffect(()=>{
        connectToWs();
    },[])
    
    // 웹소켓 연결
    function connectToWs(){
        const ws = new WebSocket('ws://localhost:4000')
        setWs(ws)
        ws.addEventListener('message',handleMessage)
        ws.addEventListener('close', () => {
            setTimeout(() => {
              console.log('Disconnected. Trying to reconnect.');
              connectToWs();
            }, 1000);
          });
    }

    // 웹소켓 연결된 유저들
    function showOnlinePeople(peopleArray){
        const people = {}
        peopleArray.forEach(({userId,username})=>{
            people[userId] = username;
        })
        setOnlinePeople(people);
    }

    // message 소켓 이벤트에 연결된 함수
    function handleMessage(ev) {
        const messageData = JSON.parse(ev.data);
        console.log({ev,messageData});
        if ('online' in messageData) {
          showOnlinePeople(messageData.online);
        } else if ('text' in messageData) {
          if (messageData.sender === selectedUserId) {
            setMessages(prev => ([...prev, {...messageData}]));
          }
        }
      }
    // 메세지 전송
    function sendMessage(ev){
        ev.preventDefault();
        ws.send(JSON.stringify({
            message:{
                recipient:selectedUserId, // 메세지 수신자
                text:newMessageText
            }
        }))
        setNewMessageText('')
        console.log('message sent')
        setMessages(prev => ([...prev,{
            text: newMessageText,
            sender: id,
            recipient: selectedUserId,
            _id: Date.now(),
          }]));
    }

    useEffect(()=>{
        const div = divUnderMessages.current;
        if(div){
            div.scrollIntoView({behavior:'smooth', block:'end'});
        }
    },[messages])

    // 온라인 했던 사람들을 토대로 오프라인 유저 만들기
    useEffect(()=>{
        axios.get('/people').then(res=>{
            const offLinePeopleArr = res.data
                    .filter(p=>p._id !== id)
                    .filter(p=>!Object.keys(onlinePeople).includes(p._id))
            const offlinePeople = {}
            offLinePeopleArr.forEach(p=>{
                offlinePeople[p._id] =p;
            })
            setOfflinePeople(offlinePeople)
        })
    },[onlinePeople])

    // 채팅방 데이터 가져오기
    useEffect(() => {
        if (selectedUserId) {
          axios.get('/messages/'+selectedUserId).then(res => {
            setMessages(res.data);
          });
        }
      }, [selectedUserId]);

    const onlinePeopleExcludLoginUser = {...onlinePeople}
    delete onlinePeopleExcludLoginUser[id]

    const messagesWithoutDupes = uniqBy(messages, '_id');
    
    return(
        <div className="flex h-screen">
            {/* 웹소켓에 연결된 온라인 유저 목록  */}
            <div className="bg-white w-1/3">
                <Logo/>
                {/* 온라인유저 리스트 */}
                {Object.keys(onlinePeopleExcludLoginUser).map(userId=>(
                    <ContackUserList 
                        key={userId}
                        userId={userId} 
                        setSelectedUserId={setSelectedUserId}selectedUserId={selectedUserId} 
                        username={onlinePeopleExcludLoginUser[userId]}
                        online={true}
                    />
                ))}
                {/* 오프라인유저 리스트 */}
                {Object.keys(offlinePeople).map(userId=>(
                    <ContackUserList 
                        key={userId}
                        userId={userId} 
                        setSelectedUserId={setSelectedUserId}selectedUserId={selectedUserId} 
                        username={offlinePeople[userId].username}
                        online={false}
                    />
                ))}
            </div>
            {/* 선택한 유저와의 채팅방 화면 */}
            <div className="flex flex-col bg-blue-50 w-2/3 p-2">
                <div className="flex-grow">
                    {!selectedUserId&&(
                        <div className="flex h-full items-center justify-center">
                            <div className="text-gray-300">
                                &larr; Select a person from a sidebar
                            </div>
                        </div>
                    )}
                    {!!selectedUserId && (
                        <div className="mb-4 h-full">
                            <div className="relative h-full">
                                <div className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2">
                            {messagesWithoutDupes.map(message => (
                                <div key={message._id} className={(message.sender === id ? 'text-right': 'text-left')}>
                                <div className={"text-left inline-block p-2 my-2 rounded-md text-sm " +(message.sender === id ? 'bg-blue-500 text-white':'bg-white text-gray-500')}>
                                    {message.text}
                                </div>
                                </div>
                            ))}
                            <div ref={divUnderMessages}></div>
                            </div>
                        </div>
                        </div>
                    )}
                </div>
                {!!selectedUserId && (
                    <form className="flex gap-2" onSubmit={sendMessage}>
                        <input  
                            type="text" 
                            value={newMessageText}
                            onChange={ev=>setNewMessageText(ev.target.value)}
                            placeholder="Type your message here" className="bg-white flex-grow p-2 border rounded-sm" />
                        <button className="bg-blue-500 p-2 rounded-sm text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}