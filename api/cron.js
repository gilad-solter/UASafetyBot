// https://github.com/yagop/node-telegram-bot-api/issues/319#issuecomment-324963294
// Fixes an error with Promise cancellation
process.env.NTBA_FIX_319 = 'test';

// Require our Telegram helper package
import TelegramBot from 'node-telegram-bot-api';
import { getSubscribers } from './_PersistenceApi.js';

export default async function handler(request, response) {
	try {
        const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

        const subscribers = await getSubscribers();

        for(const subscriberId of subscribers) {
			await bot.sendMessage(
				+subscriberId,
				'Hello, welcome to the UA Safety Bot, to start please type: \/start',
				{
					parse_mode: 'Markdown',
				}
            );
		};
	} catch (error) {
		console.error('Error sending message');
		console.log(error.toString());
    }
    
    response.send('OK: ' + process.env.TELEGRAM_TOKEN);
}
