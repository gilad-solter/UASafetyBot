// https://github.com/yagop/node-telegram-bot-api/issues/319#issuecomment-324963294
// Fixes an error with Promise cancellation
process.env.NTBA_FIX_319 = 'test';

// Require our Telegram helper package
import TelegramBot from 'node-telegram-bot-api';
import {
	storeIsSafe,
	storeLocation,
	storeName,
	storeNeedAssistance,
} from './_PersistenceApi.js';

let bot;
let id;

const strings = {
	START_WITH_BACKSLASH: '/start',
	START: 'start',
	START_CAPITALIZED: 'Start',

	// 'Are you safe?',
	YES_IM_SAFE: "Yes I'm safe",
	NO_IM_NOT_SAFE: "No, i'm not safe",

	// Q: 'Where are you currently located?'
	KYIV: 'Kyiv',
	KHARKIV: 'Kharkiv',
	LVIV: 'Lviv',
	OTHER_LOCATION: 'Other location',

	// (if the user chose 'Other location')):
	// Q: 'Do you want to share location?',
	NO_I_DONT_WANT_TO_SHARE_LOCATION: "No, I don't want to share location",
	YES_I_WANT_TO_SHARE_LOCATION: 'Yes, I want to share my location',

	// (If the user chose A2):
	// Show a button to share location.

	// Q: 'Do you need assistance?',
	NO_I_DONT_NEED_ASSISTANCE: "No I don't need assistance",
	YES_I_NEED_ASSISTANCE: 'Yes, I need assistence',

	// (if the user chose A2):
	// Q: 'How can we assist you?',
	// Open text question
};

export default async function handler(request, response) {
	try {
		const { body } = request;
		const {
			chat: { id: chatId, first_name, last_name },
			text,
			location,
		} = body.message;

		bot = new TelegramBot(process.env.TELEGRAM_TOKEN);
		id = chatId;

		if (location) {
			await storeLocation(id, JSON.stringify(location));
			await sendMultipleAnswerQuestion('Do you need assistance?', [
				strings.NO_I_DONT_NEED_ASSISTANCE,
				strings.YES_I_NEED_ASSISTANCE,
			]);
		} else if (text) {
			switch (text) {
				case strings.START:
				case strings.START_WITH_BACKSLASH:
				case strings.START_CAPITALIZED:
					const name = first_name + ' ' + last_name;
					await storeName(id, name);
					await sendMultipleAnswerQuestion('Are you safe?', [
						strings.YES_IM_SAFE,
						strings.NO_IM_NOT_SAFE,
					]);
					break;

				case strings.YES_IM_SAFE:
				case strings.NO_IM_NOT_SAFE:
					await storeIsSafe(id, text);
					await sendMultipleAnswerQuestion(
						'Where are you currently located?',
						[
							strings.KYIV,
							strings.KHARKIV,
							strings.LVIV,
							strings.OTHER_LOCATION,
						]
					);
					break;

				case strings.KYIV:
				case strings.KHARKIV:
				case strings.LVIV:
				case strings.NO_I_DONT_WANT_TO_SHARE_LOCATION:
					await storeLocation(id, text);
					await sendMultipleAnswerQuestion(
						'Do you need assistance?',
						[
							strings.NO_I_DONT_NEED_ASSISTANCE,
							strings.YES_I_NEED_ASSISTANCE,
						]
					);
					break;

				case strings.OTHER_LOCATION:
					await storeLocation(id, text);
					await sendMultipleAnswerQuestion(
						'Do you want to share location?',
						[
							strings.NO_I_DONT_WANT_TO_SHARE_LOCATION,
							strings.YES_I_WANT_TO_SHARE_LOCATION,
						]
					);
					break;

				case strings.YES_I_WANT_TO_SHARE_LOCATION:
					await sendLocationRequest();
					await storeLocation(id, text);
					break;

				case strings.NO_I_DONT_NEED_ASSISTANCE:
					await storeNeedAssistance(id, false);
					await sendTextMessage('Thank you! Stay safe!');
					break;

				case strings.YES_I_NEED_ASSISTANCE:
					await storeNeedAssistance(id, true);
					await sendTextMessage('How can we assist you?');
					break;

				default:
					await storeNeedAssistance(id, text);
					// treat response as an answer to 'how can we assist you?'
					await sendTextMessage('Thank you! Stay safe!');
					break;
			}
		}
	} catch (error) {
		console.error('Error sending message');
		console.log(error.toString());
	}

	response.send('OK: ' + process.env.TELEGRAM_TOKEN);
}

async function sendMultipleAnswerQuestion(question = '', answers = []) {
	const keyboard = answers.map((answer) => [answer]);

	await bot.sendMessage(id, question, {
		reply_markup: JSON.stringify({
			keyboard,
			resize_keyboard: true,
			one_time_keyboard: true,
		}),
	});
}

async function sendTextMessage(text) {
	await bot.sendMessage(id, text, {
		parse_mode: 'Markdown',
		resize_keyboard: true,
		one_time_keyboard: true,
	});
}

async function sendLocationRequest() {
	await bot.sendMessage(id, 'Please share your location', {
		reply_markup: JSON.stringify({
			keyboard: [
				[
					{
						text: 'Click to share location (mobile only)',
						request_location: true,
					},
				],
			],
			resize_keyboard: true,
			one_time_keyboard: true,
		}),
	});
}
