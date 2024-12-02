import express from 'express';
import bodyParser from 'body-parser';
import { v4 } from 'uuid';
import path from 'path';
import generatePosterImage from './poster-generator'
// import nodeHtmlToImage from 'node-html-to-image';
// import puppeteer from 'puppeteer';

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
    x = x.replace(/(^|[^/])'/g, '$1"');
    x = x.replaceAll("/'", "'");
    return JSON.parse(x);
}


app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public'), {
    extensions: ['html'],
}));

app.use(express.static('public'));
app.get('/force-refresh', (req, res) => {
    sessions = {};
    liveUsers = {};
    res.send('ACTIVE');
    return;
});

/* Receiving Messages (chat -> AI) */
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
                        text: '이전 요청을 분석중이에요',
                    },
                }],
            },
        });
        return;
    }
    res.json({
        version: "2.0",
        useCallback: true,
        data: {
            text: ('q' in clientExtra) ? '이전 질문에 대한 답변을 보내드릴게요' : ('session' in clientExtra) ? '답변을 생성중이에요' : '',
        },
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
    console.log(`${SessionId} | kakao/callback-request | utterance: ${Utterance}${('q' in clientExtra) ? ` (${clientExtra.q})` : ''}`);

    const ModelURL = 'http://3.37.186.94:1500/api/ask';
    const ModelQuery = {
        sessionId: SessionId,
        uid: UID,
        question: ('q' in clientExtra) ? clientExtra.q : Utterance,
        is_from_list: 'session' in clientExtra,
        isAcute: 'isAcute' in clientExtra && clientExtra.isAcute,
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
// app.post('/kakao/callback-request/init', async (req, res) => {

// });


/* Sending Message (AI -> chat) */
app.post('/kakao/callback-response/simple-text', async (req, res) => {
    // sessionId: string
    // answer: string
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
app.post('/kakao/callback-response/list-card', async (req, res) => {
    // sessionId: string
    // originalQuestion: string
    // question: string[]
    // isAcute: string
    const SessionId: string = req.body.sessionId;
    const originalQuestion: string = req.body.originalQuestion;
    const isAcute: boolean = req.body.isAcute as boolean;
    const Answer: string[] = safeJSONParser(req.body.question.replaceAll("\"", "\\\""));
    if (!(SessionId in sessions)) {
        return;
    }
    const URL: string = sessions[SessionId].callbackUrl;

    console.log(`${SessionId} | kakao/callback-response/list-card | answer: ${Answer}`);
    delete liveUsers[sessions[SessionId].uid];
    delete sessions[SessionId];

    const listItems: Array<any> = Answer.map((v: string) => {
        return {
            "title": v,
            "action": "message",
            "messageText": v,
            "extra": {
                "isAcute": isAcute,
                "session": SessionId
            }
        };
    });
    const buttons: Array<any> = originalQuestion ? [
        {
            "label": "찾는 내용이 없어요",
            "action": "message",
            "messageText": "찾는 내용이 없어요",
            "extra": {
                "q": originalQuestion,
                "session": SessionId
            }
        }
    ] : [];
    const callbackResponse = {
        "version": "2.0",
        "template": {
            "outputs": [
                {
                    simpleText: {
                        text: '아래 질문지 중 하나를 선택해주세요',
                    },
                },
                {
                    "listCard": {
                        "header": {
                            "title": "아래 질문지 중 하나를 선택해주세요"
                        },
                        "items": listItems,
                        "buttons": buttons,
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
app.post('/kakao/callback-response/poster', async (req, res) => {
    // sessionId: string
    // answer: {
    //     template_type: string
    //     content: {
    //         question: string
    //         answer: string
    //     }
    // }
    const SessionId: string = req.body.sessionId;
    if (!(SessionId in sessions)) {
        return;
    }
    const URL: string = sessions[SessionId].callbackUrl;

    delete liveUsers[sessions[SessionId].uid];
    delete sessions[SessionId];

    const Answer = JSON.parse(req.body.answer);
    const PosterType: string = Answer.template_type || 'qna__square_single';
    const Q: string = Answer.content.question;
    const A: string = Answer.content.answer;
    const key: string = Answer.tts_key;
    const definitions = Answer.content.definitions;
    const metadata: string = `type=${PosterType}&q=${encodeURI(Q)}&a=${encodeURI(A)}&k=${encodeURI(key)}&d=${encodeURI(JSON.stringify(definitions))}`;
    // console.log(Answer.content)

    // const PosterURL: string = `https://nhs.rocknroll17.com/render/poster?c=${btoa(metadata)}`;
    const PosterURL: string = `https://nhs.rocknroll17.com/poster?c=${btoa(metadata)}`;
    console.log(`${SessionId} | kakao/callback-response/poster | type: ${PosterType}`);
    console.log(`${SessionId} | kakao/callback-response/poster |    Q: ${Q}`);
    console.log(`${SessionId} | kakao/callback-response/poster |    A: ${A}`);

    // const callbackResponse = {
    //     version: '2.0',
    //     template: {
    //         outputs: [
    //             {
    //                 simpleImage: {
    //                     imageUrl: PosterURL,
    //                     altText: '',
    //                 },
    //             },
    //         ],
    //     },
    // };
    const callbackResponse = {
        "version": "2.0",
        "template": {
            "outputs": [
                {
                    "textCard": {
                        "title": "답변이 도착했어요",
                        // "description": "아래 버튼을 눌러 확인해주세요",
                        "buttons": [
                            {
                                "action": "webLink",
                                "label": "답변 확인하기",
                                "webLinkUrl": PosterURL,
                            },
                        ],
                    },
                },
            ],
        },
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
app.post('/kakao/callback-response/acute', async (req, res) => {
    // sessionId: string
    // answer: {
    //     template_type: string
    //     content: {
    //         answer: string
    //     }
    // }
    const SessionId: string = req.body.sessionId;
    if (!(SessionId in sessions)) {
        return;
    }
    const URL: string = sessions[SessionId].callbackUrl;

    delete liveUsers[sessions[SessionId].uid];
    delete sessions[SessionId];

    // console.log(req.body.answer)
    const Answer = req.body.answer;
    const callbackResponse = {
        "version": "2.0",
        "template": {
            "outputs": [
                {
                    "textCard": {
                        "title": "답변이 도착했어요",
                        "description": "급성 질병에 관한 내용이 포함된 질문입니다. 아래 링크를 확인해주세요.",
                        "buttons": [
                            {
                                "action": "webLink",
                                "label": "진단 및 검사 방법",
                                "webLinkUrl": Answer,
                            },
                        ],
                    },
                },
            ],
        },
    };

    await fetch(URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(callbackResponse),
    }).then((res) => res.json()).then((data) => {
        console.log(`${SessionId} | kakao/callback-response/acute | kakao response: ${data.status}`);
    });

    res.status(200).json({ message: 'success' });
    return;
});

app.get('/render/poster', async (req, res) => {
    const c: string = req.query.c as string;
    const image = await generatePosterImage(c);
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(image, 'binary');

});


app.listen(port, () => {
    console.log(`KakaoTalk chatbot server is running on port ${port}`);
});