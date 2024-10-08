import express from 'express';
import bodyParser from 'body-parser';
const app = express();
const port = 3000;
app.use(bodyParser.json());
app.post('/webhook', (req, res) => {
    const { userRequest } = req.body;
    const userMessage = userRequest.utterance;
    let responseMessage = '';
    if (userMessage.includes('hello')) {
        responseMessage = 'Hello! How can I help you today?';
    }
    else {
        responseMessage = 'Sorry, I did not understand that.';
    }
    const responseBody = {
        version: "2.0",
        template: {
            outputs: [
                {
                    simpleText: {
                        text: responseMessage
                    }
                }
            ]
        }
    };
    res.status(200).send(responseBody);
});
app.listen(port, () => {
    console.log(`KakaoTalk chatbot server is running on port ${port}`);
});
