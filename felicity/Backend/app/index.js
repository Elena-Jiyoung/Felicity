const express = require("express");
const cors = require("cors");
const config = require("./config")
const socket = require("socket.io");
const transcribe = require("../stt");
const conn = require("./connection/connection")
const videocall = require("./videocall/videocall")
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

var bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());

app.use(require("./patientfindIDPW/router"));
app.use(require("./doctorfindIDPW/router"));
app.use(require("./psignup/router"));
app.use(require('./dsignup/router'));
app.use(require("./sendMail/router"));

app.use(require("./doctorlogin/router"));   // "/dlogin"
app.use(require("./patientlogin/router"));  // "/plogin"
app.use(require("./posts/router"));         // "/post"
app.use(require("./schedule/router"));      // "/patient_schedule" or "/doctor_schedule"
app.use(require("./status/router"));        // "dstatus" or "pstatus"
app.use(require("./conv/router"));
app.use(require("./videocall/router"));
app.use(require("./availabledoctor/router"));      // "/available-doctor"
app.use(require("./profile/router"));
app.use(require("./upload/router"));
//app.use("/upload", express.static("upload"));
app.use(require("./doctornote/router"));
app.use("/profile_images", express.static("profile_images"));

// const login = require("./login.js")

app.get("/", (req, res) => {
    res.send('Health Check');
});

//express-session for storing translation
const session = require("express-session");
const cookieParser = require("cookie-parser");
app.use(cookieParser());
app.use(session({
    secure: true,	// https 환경에서만 session 정보를 주고받도록처리
    secret: "12345", // 암호화하는 데 쓰일 키
    resave: false, // 세션을 언제나 저장할지 설정함
    saveUninitialized: true, // 세션에 저장할 내역이 없더라도 처음부터 세션을 생성할지 설정
    cookie: {	//세션 쿠키 설정 (세션 관리 시 클라이언트에 보내는 쿠키)
    httpOnly: true, // 자바스크립트를 통해 세션 쿠키를 사용할 수 없도록 함
    Secure: true
    }
}))



app.get('/saveTranslation', function(req, res) {
    const file = req.file

    const dataURL = file.audio.dataURL.split(",").pop()
    let fileBuffer = Buffer.from(dataURL, "base64")
    const result = transcribe(fileBuffer)
    if(result[0]!==undefined){
        req.session.transcription = result[0].transcription;
        req.session.translation = result[0].translation;
        //세션 스토어가 이루어진 후 redirect를 해야함.
        req.session.save(function(){                              
            res.redirect('/');
        });
    }
    
})



// const port = 3001;
const server = app.listen(config.express.port, () => {
    console.log(`Server running on Port ${config.express.port}`);
    const dir1 = "./uploads";
    if (!fs.existsSync(dir1)) {
        fs.mkdirSync(dir1);
    }
    const dir2 = "./profile_images";
    if (!fs.existsSync(dir2)) {
        fs.mkdirSync(dir2);
    }
});

//login using jwt
//doctor login
app.post('/dlogin', (req, res) => {
    const email = req.body.email
    const password = req.body.password
    const result = login.docLogin([email, password])
    res.json({ accessToken: result[1], doctorID: result[0] })
})

//patient login
app.post('/plogin', (req, res) => {
    const email = req.body.email
    const password = req.body.password
    const result = login.paLogin([email, password])
    res.json({ accessToken: result[1], doctorID: result[0] })
})

const io = socket(server, {
    cors: {
        origin: "*",
    },
});

let resultObj = []
io.on("connection", async socket => {
    socket.on("message-transcribe", async (file) => {
        const dataURL = file.audio.dataURL.split(",").pop()
        let fileBuffer = Buffer.from(dataURL, "base64")
        const result = await transcribe(fileBuffer)
        resultObj.push(result)
        console.log(result)
        socket.emit("result", result)
        socket.emit("storage", resultObj)
    })

    socket.on("send-transcription", ({ userToCall, text }) => {
        io.to(userToCall).emit("reresult", text)
    })

    socket.on("reconnection", (data) => {
        console.log(socket.id, data, data[0], data[1])
        if (data[1] == "false") {
            conn.doctorReconnection(socket, data[0], (err, result) => {
                if (err) console.log(err);
            })
        }
        else {
            conn.patientReconnection(socket, data[0], (err, result) => {
                if (err) console.log(err);
            })
        }
    })

    console.log(socket.id);

    socket.on("login", (data) => {
        console.log(data);
        const userid = data[0];
        const role = data[1];

        if (!role) {
            conn.socketDoctorLogin(userid, socket, io, (err, result) => {
                if (err) console.log(err);
            })
        }
        else {
            conn.socketPatientLogin(userid, socket, io, (err, result) => {
                if (err) console.log(err);
            })
        }
    })

    socket.on("start", (data) => {
        const rid = data.reservation_id;
        const role = data.role;
        
        // When doctor enters the room
        if (!role) {
            videocall.doctorEnterRoom(rid, (error, result) => {
                if (error) console.log(error);
            })
            videocall.checkPatientInRoom(rid, io, socket, (error, result) => {
                if (error) console.log(error);
            })
        }
        // When patient enters the room
        else {
            videocall.patientEnterRoom(rid, (error, result) => {
                if (error) console.log(error);
            })
            videocall.checkDoctorInRoom(rid, io, socket, (error, result) => {
                if (error) console.log(error);
            })
        }

    });

    socket.on("leavecall", (data) => {
        const rid = data.reservation_id;
        const role = data.role;

        // When doctor leaves the room
        if (!role) {
            videocall.doctorLeaveRoom(rid, (err, result) => {
                if (err) console.log(err);
            })
        }
        // When patient leaves the room
        else {
            videocall.patientLeaveRoom(rid, (err, result) => {
                if (err) console.log(err);
            })
        }
    });

    socket.on("calluser", ({ userToCall, signalData, from, someName }) => {
        io.to(userToCall).emit("calluser", { signal: signalData, from, someName });
    });

    socket.on("answercall", (data) => {
        io.to(data.to).emit("callaccepted", data.signal);
    });

    socket.on("chat", ({ userToCall, name, msg, time }) => {
        // const { name, msg, time } = data;
        io.to(userToCall).emit("chatting", {
            name,
            msg,
            time
        })
    })

    socket.on("doctorChatSend", ({ name, msg, time, file }) => {
        io.emit("doctorchatting", {
            name,
            msg,
            time,
            file
        })
    })

    socket.on("convChatSend", ({ name, msg, time }) => {
        io.emit("convchatting", {
            name,
            msg,
            time
        })
    })

    socket.on("changeProfileImage1", ({ file }) => {
        io.emit("changeProfileImage2", { file })
    })

    socket.on("disconnect", () => {
        console.log(`disconnected: ${socket.id}`);
        conn.doctorDisconnection(socket, (err, result) => {
            if (err) console.log(err);
            else console.log(result);
        })
        conn.patientDisconnection(socket, (err, result) => {
            if (err) console.log(err);
            else console.log(result);
        })
    })
})