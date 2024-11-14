import express from 'express';
import bodyParser from 'body-parser';
import { v4 } from 'uuid';
import path from 'path';

const app = express();
const port = 5000;

interface Session {
    // sessionId: string,
    callbackUrl: string,
    uid: string,
    // timestamp: number,
}
interface SessionStorage {
    [id: string]: Session,
};
let sessions: SessionStorage = {};
let liveUsers: { [uid: string]: number } = {};

const safeJSONParser = (x: string) => {
    x = x.replaceAll("\'", "\"");
    return JSON.parse(x);
}


app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public'), {
    extensions: ['html'],
}));

// app.get('/', (req, res) => {
//     res.send('ACTIVE');
//     return;
// });
app.use(express.static('public'));
app.get('/force-refresh', (req, res) => {
    sessions = {};
    liveUsers = {};
    res.send('ACTIVE');
    return;
});
// app.get('/poster', (req, res) => {
//     res.sendFile('poster.html', { root: path.join(__dirname, '../public') });
//     return;
// });

// app.post('/repeater', (req, res) => {
//     res.json({
//         version: "2.0",
//         template: {
//             outputs: [{
//                 simpleText: {
//                     text: req.body.userRequest.utterance,
//                 },
//             }],
//         },
//     });
//     return;
// });

app.post('/kakao/callback-request', async (req, res) => {
    const URL: string = req.body.userRequest.callbackUrl;
    const UID: string = req.body.userRequest.user.id;
    const Utterance: string = req.body.userRequest.utterance;
    const clientExtra = req.body.action.clientExtra;

    if (liveUsers[UID] && liveUsers[UID] + 60000 > new Date().getTime()) {
        res.json({
            version: "2.0",
            template: {
                outputs: [{
                    simpleText: {
                        text: '이전 요청을 분석중입니다.',
                    },
                }],
            },
        });
        return;
    }
    res.json({
        version: "2.0",
        useCallback: true,
        // data: {
        //     text: '잠시만 기다려 주세요',
        // },
    });

    const SessionId: string = ('session' in clientExtra) ? clientExtra.session : v4();
    const CurrentSession: Session = {
        // sessionId: SessionId,
        callbackUrl: URL,
        uid: UID,
    };
    liveUsers[UID] = new Date().getTime();
    sessions[SessionId] = CurrentSession;
    console.log(`${SessionId} | kakao/callback-request | timestamp: ${liveUsers[UID]}`);
    console.log(`${SessionId} | kakao/callback-request | utterance: ${Utterance}`);

    const ModelURL = 'http://100.99.151.44:1500/api/ask';
    const ModelQuery = {
        sessionId: SessionId,
        uid: UID,
        question: ('q' in clientExtra) ? clientExtra.q : Utterance,
        is_from_list: 'session' in clientExtra,
        q_not_found: false,
    };

    await fetch(ModelURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(ModelQuery),
    }).then((res) => {
        // console.log(res);
        return res.json();
    }).then((data) => {
        console.log(`${SessionId} | kakao/callback-request | query response: ${data.message}`);
        return data.message;
    }).catch((e) => {
        console.error(`${SessionId} | kakao/callback-request | fetch error`);
        console.error(e);
        delete liveUsers[UID];
        delete sessions[SessionId];
        return '[ERROR]';
    });

    res.end();
    return;
});

// requires sessionId, answer
app.post('/kakao/callback-response/simple-text', async (req, res) => {
    const SessionId: string = req.body.sessionId;
    const Answer: string = req.body.answer;
    if (!(SessionId in sessions)) {
        return;
    }
    const URL: string = sessions[SessionId].callbackUrl;

    console.log(`${SessionId} | kakao/callback-response/simple-text | answer: ${Answer}`);
    delete liveUsers[sessions[SessionId].uid];
    delete sessions[SessionId];

    const callbackResponse = {
        version: "2.0",
        template: {
            outputs: [{
                simpleText: {
                    text: Answer,
                },
            }],
        },
    };

    await fetch(URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(callbackResponse),
    }).then((res) => res.json()).then((data) => {
        console.log(`${SessionId} | kakao/callback-response/simple-text | kakao response: ${data.status}`);
    });

    res.status(200).json({ message: 'success' });
    return;
});

// requires sessionId, answer list
app.post('/kakao/callback-response/list-card', async (req, res) => {
    const SessionId: string = req.body.sessionId;
    const Answer: string[] = safeJSONParser(req.body.question);
    if (!(SessionId in sessions)) {
        return;
    }
    const URL: string = sessions[SessionId].callbackUrl;

    console.log(`${SessionId} | kakao/callback-response/list-card | answer: ${Answer}`);
    delete liveUsers[sessions[SessionId].uid];
    delete sessions[SessionId];

    let listItems: Array<any> = Answer.map((v: string) => {
        return {
            "title": v,
            "action": "message",
            "messageText": v,
            "extra": {
                "q": v,
                "session": SessionId
            }
        };
    });
    // listItems.push({
    //     "title": "찾는 내용이 없어요",
    //     "description": "이전 질문에 대한 답변을 받을래요",
    //     "action": "message",
    //     "messageText": "찾는 내용이 없어요",
    //     "extra": {
    //         "q": "찾는 내용이 없어요",
    //         "session": SessionId
    //     }
    // });
    const callbackResponse = {
        "version": "2.0",
        "template": {
            "outputs": [
                {
                    "listCard": {
                        "header": {
                            "title": "아래 질문지 중 하나를 선택해주세요"
                        },
                        "items": listItems,
                        "buttons": [
                            {
                                "label": "찾는 내용이 없어요",
                                "action": "message",
                                "messageText": "찾는 내용이 없어요",
                                "extra": {
                                    "q": "찾는 내용이 없어요",
                                    "session": SessionId
                                }
                            }
                        ]
                    }
                }
            ]
        }
    };

    await fetch(URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(callbackResponse),
    }).then((res) => res.json()).then((data) => {
        console.log(`${SessionId} | kakao/callback-response/list-card | kakao response: ${data.status}`);
    });

    res.status(200).json({ message: 'success' });
    return;
});

// requires sessionId, posterType, posterContent
app.post('/kakao/callback-response/poster', async (req, res) => {
    const SessionId: string = req.body.sessionId;
    if (!(SessionId in sessions)) {
        return;
    }
    const URL: string = sessions[SessionId].callbackUrl;

    delete liveUsers[sessions[SessionId].uid];
    delete sessions[SessionId];


    const Answer = safeJSONParser(req.body.answer);
    const PosterType: string = Answer.template_type || 'qna__square_single';
    const Q: string = Answer.content.question;
    const A: string = Answer.content.answer;
    const metadata: string = `type=${PosterType}&q=${encodeURI(Q)}&a=${encodeURI(A)}`;

    const PosterURL: string = `https://nhs.rocknroll17.com/poster?c=${btoa(metadata)}`;
    console.log(`${SessionId} | kakao/callback-response/poster | type: ${PosterType}`);
    console.log(`${SessionId} | kakao/callback-response/poster |    Q: ${Q}`);
    console.log(`${SessionId} | kakao/callback-response/poster |    A: ${A}`);


    let callbackResponse = {};
    callbackResponse = {
        "version": "2.0",
        "template": {
            "outputs": [
                {
                    "textCard": {
                        "title": "답변이 도착했어요",
                        "description": "아래 버튼을 눌러 확인해주세요",
                        "buttons": [
                            {
                                "action": "webLink",
                                "label": "답변 확인하기",
                                "webLinkUrl": PosterURL,
                            },
                        ]
                    }
                }
            ]
        }
    };

    await fetch(URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(callbackResponse),
    }).then((res) => res.json()).then((data) => {
        console.log(`${SessionId} | kakao/callback-response/poster | kakao response: ${data.status}`);
    });

    res.status(200).json({ message: 'success' });
    return;
});

app.listen(port, () => {
    console.log(`KakaoTalk chatbot server is running on port ${port}`);
});