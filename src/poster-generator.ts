
import path from 'path';
import puppeteer from 'puppeteer';
// const puppeteer = require('puppeteer');
// const path = require('path');

const generatePosterImage = async (encodedParams: string) => {
    // console.log('Launching browser...');
    const browser = await puppeteer.launch({
        // headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: {
            width: 375,
            height: 500,
            deviceScaleFactor: 3
        }
    });

    try {
        // console.log('Creating new page...');
        const page = await browser.newPage();

        // Construct URL with parameters
        // const encodedParams = Buffer.from(
        //     new URLSearchParams(params).toString()
        // ).toString('base64');

        const htmlPath = `file://${path.resolve(__dirname, '../src/poster-component.html')}?c=${encodedParams}`;
        // console.log('Loading HTML:', htmlPath);
        await page.goto(htmlPath);

        // console.log('Waiting for poster container...');
        await page.waitForSelector('body', { timeout: 5000 });

        // console.log('Taking screenshot...');
        const element = await page.$('body');
        const screenshot = await element?.screenshot({
            type: 'jpeg',
            quality: 100
        });

        return screenshot;

    } catch (error) {
        console.error('Error generating poster:', error);
        throw error;
    } finally {
        await browser.close();
        // console.log('Browser closed');
    }
};

export default generatePosterImage;