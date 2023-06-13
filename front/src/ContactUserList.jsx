import Avatar from "./Avatar";

export default function ContackUserList({userId,setSelectedUserId,selectedUserId,username,online}){
    return(
        <div key={userId} onClick={()=>setSelectedUserId(userId)} className={"border-b border-gray-100  flex items-center gap-2 cursor-pointer "+(userId===selectedUserId ? 'bg-blue-50' : '')}>
            {userId===selectedUserId && (
                <div className="w-1 bg-blue-500 h-12 rounded-r-md"></div>
            )}
            <div className="flex items-center gap-2 py-2 pl-4 ">
                <Avatar online={online} username={username} userId={userId} />
                <span className="text-gray-800">{username}</span>
            </div>
        </div>
    )
}