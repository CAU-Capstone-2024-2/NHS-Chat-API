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
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
const port = 3000;
;
let sessions = {};
let liveUsers = {};
app.use(body_parser_1.default.json());
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
app.post('/kakao/callback-request', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const URL = req.body.userRequest.callbackUrl;
    const UID = req.body.userRequest.user.id;
    const Utterance = req.body.userRequest.utterance;
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
    const SessionId = (0, uuid_1.v4)();
    const CurrentSession = {
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
    const ModelQueryResponse = yield fetch(ModelURL, {
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
        return '[ERROR]';
    });
}));
// requires sessionId, answer
app.post('/kakao/callback-response/simple-text', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const SessionId = req.body.sessionId;
    const Answer = req.body.answer;
    const URL = sessions[SessionId].callbackUrl;
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
    yield fetch(URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(callbackResponse),
    }).then((res) => res.json()).then((data) => {
        console.log(`${SessionId} | kakao/callback-response/simple-text | kakao response: ${data.status}`);
    });
    res.status(200).json({ message: 'success' });
}));
// requires sessionId, posterType, posterContent
app.post('/kakao/callback-response/poster', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const SessionId = req.body.sessionId;
    const PosterType = 'qna/square-single';
    // const Answer: string = req.body.answer;
    const URL = sessions[SessionId].callbackUrl;
}));
app.get('/poster*', (req, res) => {
    res.sendFile('poster.html', { root: path_1.default.join(__dirname, '../public') });
});
app.listen(port, () => {
    console.log(`KakaoTalk chatbot server is running on port ${port}`);
});
