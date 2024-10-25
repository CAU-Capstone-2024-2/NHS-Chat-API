import express from 'express';
import bodyParser from 'body-parser';
import { v4 } from 'uuid';
import path from 'path';

const app = express();
const port = 3000;

interface Session {
    // sessionId: string,
    callbackUrl: string,
    uid: string,
}
interface SessionStorage {
    [id: string]: Session,
};
let sessions: SessionStorage = {};
let liveUsers: { [uid: string]: boolean } = {};


app.use(bodyParser.json());

app.get('/test', (req, res) => {
    res.send('Hello World!');
});

app.post('/repeater', (req, res) => {
    res.json({
        version: "2.0",
        template: {
            outputs: [{
                simpleText: {
                    text: req.body.userRequest.utterance,
                },
            }],
        },
    });
});

app.post('/kakao/callback-request', async (req, res) => {
    const URL: string = req.body.userRequest.callbackUrl;
    const UID: string = req.body.userRequest.user.id;
    const Utterance: string = req.body.userRequest.utterance;

    if (liveUsers[UID]) {
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
        data: {
            text: `[${UID}]의 요청을 분석중입니다.`,
        },
    });

    const SessionId: string = v4();
    const CurrentSession: Session = {
        // sessionId: SessionId,
        callbackUrl: URL,
        uid: UID,
    };
    liveUsers[UID] = true;
    sessions[SessionId] = CurrentSession;
    console.log(`${SessionId} | kakao/callback-request | utterance: ${Utterance}`);

    const ModelQuery = {
        sessionId: SessionId,
        uid: UID,
        question: Utterance,
    };

    const ModelURL = 'http://100.99.151.44:1500/api/ask';
    const ModelQueryResponse: string = await fetch(ModelURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(ModelQuery),
    }).then((res) => res.json()).then((data) => {
        console.log(`${SessionId} | kakao/callback-request | query response: ${data.message}`);
        return data.message;
    }).catch((e) => {
        console.error(e);
        delete liveUsers[UID];
        delete sessions[SessionId];
        return '[ERROR]'
    });
});

// requires sessionId, answer
app.post('/kakao/callback-response/simple-text', async (req, res) => {
    const SessionId: string = req.body.sessionId;
    const Answer: string = req.body.answer;
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
});

// requires sessionId, posterType, posterContent
app.post('/kakao/callback-response/poster', async (req, res) => {
    const SessionId: string = req.body.sessionId;
    const PosterType: string = 'qna__square_single';
    // const Answer: string = req.body.answer;
    const URL: string = sessions[SessionId].callbackUrl;
});
app.get('/poster', (req, res) => {
    res.sendFile('poster.html', { root: path.join(__dirname, '../public') });
});

app.listen(port, () => {
    console.log(`KakaoTalk chatbot server is running on port ${port}`);
});