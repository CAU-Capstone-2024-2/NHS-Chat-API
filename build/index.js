"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const app = (0, express_1.default)();
const port = 3000;
;
let sessions = {};
app.use(body_parser_1.default.json());
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
app.post('/kakao/callback-request', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const URL = req.body.userRequest.callbackUrl;
    const UID = req.body.userRequest.user.id;
    const Utterance = req.body.userRequest.utterance;
    res.json({
        version: "2.0",
        useCallback: true,
        data: {
            text: `[${UID}]의 요청을 분석중입니다.`,
        },
    });
    const SessionId = `2be97eb6-e813-4f0f-9eb0-c66df18522fc-${i++}`;
    const CurrentSession = {
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
    const ModelQueryResponse = yield fetch(ModelURL, {
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
        return '[ERROR]';
    });
}));
app.post('/kakao/callback-response/simple-text', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const SessionId = req.body.sessionId;
    const Answer = req.body.answer;
    const URL = sessions[SessionId].callbackUrl;
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
    yield fetch(URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(callbackResponse),
    }).then((res) => res.json()).then((data) => {
        console.log(`/kakao/callback-response/simple-text => callback: ${data.status}`);
    });
    res.status(200).json({ message: 'seccess' });
}));
app.listen(port, () => {
    console.log(`KakaoTalk chatbot server is running on port ${port}`);
});
