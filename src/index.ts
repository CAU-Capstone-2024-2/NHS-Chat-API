import express from 'express';
import bodyParser from 'body-parser';

const app = express();
const port = 3000;

interface Session {
    callbackUrl: string,
    uid: string,
}
interface SessionStorage {
    [sessionId: string]: Session,
};
let sessions: SessionStorage = {};

app.use(bodyParser.json());

app.get('/test', (req, res) => {
    res.send('Hello World!');
});

app.post('/repeater', (req, res) => {
    // const { userRequest } = req.body;
    // const userMessage = userRequest.utterance;

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

let i = 0;
app.post('/kakao/callback-request', async (req, res) => {
    const URL: string = req.body.userRequest.callbackUrl;
    const UID: string = req.body.userRequest.user.id;
    const Utterance: string = req.body.userRequest.utterance;

    res.json({
        version: "2.0",
        useCallback: true,
        data: {
            text: `[${UID}]의 요청을 분석중입니다.`,
        },
    });

    const SessionId: string = `2be97eb6-e813-4f0f-9eb0-c66df18522fc-${i++}`;
    const CurrentSession: Session = {
        callbackUrl: URL,
        uid: UID,
    };
    sessions[SessionId] = CurrentSession;
    // console.log(sessions);
    console.log(`/kakao/callback-request => utterance: ${Utterance}`);

    const ModelQuery = {
        sessionId: SessionId,
        uid: UID,
        question: Utterance,
    };
    // const ModelURL = 'http://3.37.186.94:1500/api/ask';
    const ModelURL = 'http://218.239.229.119:1500/api/ask';
    const ModelQueryResponse: string = await fetch(ModelURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(ModelQuery),
    }).then((res) => res.json()).then((data) => {
        console.log(`/kakao/callback-request => query response: ${data}`);
        return data.message;
    }).catch((e) => {
        console.error(e);
        return '[ERROR]'
    });
});

app.post('/kakao/callback-response/simple-text', async (req, res) => {
    const SessionId: string = req.body.sessionId;
    const Answer: string = req.body.answer;
    const URL: string = sessions[SessionId].callbackUrl;

    console.log(`/kakao/callback-response/simple-text => answer: ${Answer}`);
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
        console.log(`/kakao/callback-response/simple-text => callback: ${data.status}`);
    });

    res.status(200).json({ message: 'seccess' });
});

app.listen(port, () => {
    console.log(`KakaoTalk chatbot server is running on port ${port}`);
});