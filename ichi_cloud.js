const binance = require('node-binance-api')
const express = require('express')
const path = require('path')
var _ = require('lodash')
var moment = require('moment')
var numeral = require('numeral')
var readline = require('readline')
var fs = require('fs')
const TelegramBot = require('node-telegram-bot-api');
// const play = require('audio-play')
// const load = require('audio-loader')
const nodemailer = require('nodemailer')
const rsi  = require('./indicators/rsi')(14);
const ovb = require('./indicators/ovb');

//////////////////////////////////////////////////////////////////////////////////

// https://www.binance.com/restapipub.html
const APIKEY = '7hxRkF3KTID2EOnnTPxEFUjXBQinBMoA8TBFVfFUuBsUgtnTe5Zo3NHtCqqtFO54'
const APISECRET = 'wHGQ9BIKPieC1a82JtPVxnSpBC4MQO4h5F6yLQKc9mHRATz8MNOo9d9hKxFQsgf9'

const wait_time = 1000          // ms
const trading_fee = 0.1         // pourcent


// API initialization //
binance.options({
    'APIKEY': APIKEY,
    'APISECRET': APISECRET,
    'reconnect': true
});

///////////////////////////////////////////////////////////////////////////////////

// replace the value below with the Telegram token you receive from @BotFather
const token = '565941385:AAEnnyP1t54NMuKcHla2a2OhhUUWzqx5wwo';

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

const chatId = '-1001245808874';

///////////////////////////////////////////////////////////////////////////////////

let btc_price = 0

let pairs = []

let depth_bids = {}
let depth_asks = {}
let depth_diff = {}

let minute_prices = {}
let hourly_prices = {}

let tracked_pairs = []
let tracked_pair_status = [];
let total_pnl = {}
let intervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//----ICHI CLOUD----//
let tenkanSenPeriod = 20;
let kijunSenPeriod = 60;
let senkouSpanBPeriod = 120;
let chikouSpanPeriod = 30;

getAverage = (ticks, name) => {
    let highest = Math.max(...ticks.map(x => x.high));
    let lowest = Math.min(...ticks.map(x => x.low));

    return (highest + lowest) / 2.0;
}

getTenkanSen = (symbol) => {
    return getAverage(tracked_pairs[symbol].slice(0, tenkanSenPeriod), 'tenkan');
}

getKijunSen = (symbol) => {
    return getAverage(tracked_pairs[symbol].slice(0, kijunSenPeriod), 'kijun');
}

getSenkouSpanA = (symbol) => {
    let laggingTenkanSen = getAverage(tracked_pairs[symbol].slice(25, 25 + tenkanSenPeriod), 'tenkenlate');
    let laggingKijunSen = getAverage(tracked_pairs[symbol].slice(25, 25 + kijunSenPeriod), 'kijunlate');

    return (laggingTenkanSen + laggingKijunSen) / 2.0;
}

getSenkouSpanB = (symbol) => {
    return getAverage(tracked_pairs[symbol].slice(25, 25 + senkouSpanBPeriod));
}

createIchimokuElements = (symbol) => {
    return {
        tenkanSen: getTenkanSen(symbol), // Conversion Line
        kijunSen: getKijunSen(symbol), // Base Line
        senkouSpanA: getSenkouSpanA(symbol),  // Leading line 1
        senkouSpanB: getSenkouSpanB(symbol), // Leading line 2
        chikouSpan: tracked_pairs[symbol][0].price // Lagging line
    }
}


shouldBuy = (symbol, tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan) => {
    //console.log('shouldBuy')
    let chikouSpanPreviodPrice = tracked_pairs[symbol][chikouSpanPeriod - 1].price;
    let currentPrice = tracked_pairs[symbol][0].price;
    let calculatedRSI = rsi.calculateRSI(tracked_pairs[symbol][0]);
    let diffTenkanAndChikou = (tenkanSen - kijunSen) * 100.0 / kijunSen;
    let currentOVB = Math.round(tracked_pairs[symbol][0].ovb);

    var highestOVB = Math.max(...tracked_pairs[symbol].slice(0, 5).map(x => Math.round(x.ovb)));

    if (chikouSpan > chikouSpanPreviodPrice) {
        if (tenkanSen >= kijunSen && diffTenkanAndChikou < 0.7) {
            if (currentPrice > tenkanSen) {
                //console.log('percent', ((currentPrice - kijunSen) / kijunSen) * 100);
                if (((currentPrice - kijunSen) / kijunSen) * 100 < 4) {
                    if (currentOVB === highestOVB) {
                        if (calculatedRSI > 45 && calculatedRSI < 70) {
                            return true;
                        }
                    }
                }
            }
        }
    }
}

shouldSell = (symbol, tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan) => {
    let chikouSpanPreviodPrice = tracked_pairs[symbol][chikouSpanPeriod - 1].price;
    let currentPrice = tracked_pairs[symbol][0].price;
    if (chikouSpan < chikouSpanPreviodPrice) {
        if (tenkanSen < kijunSen) {
            return true;
        }
    }
}

shouldStopLoss = (symbol, tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan) => {
    let chikouSpanPreviodPrice = tracked_pairs[symbol][chikouSpanPeriod - 1].price;
    let currentPrice = tracked_pairs[symbol][0].price;
    if (chikouSpan < chikouSpanPreviodPrice) {
        if (tenkanSen < kijunSen) {
            if (currentPrice < senkouSpanA && currentPrice < senkouSpanB) {
                return true;
            }
        }
    }
}

calculateIchimoku = (symbol, tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan) => {
    if (shouldBuy(symbol, tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan)) {
        return 'BUY';
    }

    if (shouldSell(symbol, tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan)) {
        return 'SELL';
    }

    if (shouldStopLoss(symbol, tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan)) {
        return 'STOP_LOSS'
    }
}


//----END ICHI CLOUD----//


/////////////////////////////////////////////////////////////////////////////////////////////////////////////


console.log('------------ NBT starting -------------')

async function run() {

    //if (sound_alert) load('./alert.mp3').then(play);
    // await sleep(2)

    console.log('------------------------------')
    console.log(' start get_BTC_price')
    console.log('------------------------------')
    //btc_price = await get_BTC_price()
    console.log('------------------------------')
    //console.log('BTC price: $' + numeral(btc_price).format('0,0'))
    console.log('------------------------------')

    await sleep(2)

    console.log('------------------------------')
    console.log(' get_BTC_pairs start')
    console.log('------------------------------')
    pairs = await get_BTC_pairs()
    //pairs.unshift('BTCUSD')
    console.log('------------------------------')

    //pairs = pairs.slice(0, 1) //for debugging purpose
    //pairs = ['GASBTC'];
    console.log("Total BTC pairs: " + pairs.length)
    console.log('------------------------------')

    await sleep(2)

    console.log('------------------------------')
    console.log(' run detector')
    console.log('------------------------------')
    await get_candleSticks_for_BTC_pairs(intervals[4]);
}


sleep = (x) => {
    return new Promise(resolve => {
        setTimeout(() => { resolve(true) }, x )
    });
}

get_BTC_price = () => {
    return new Promise(resolve => {
        binance.websockets.candlesticks(['BTCUSDT'], "15m", (candlesticks) => {
            let { e:eventType, E:eventTime, s:symbol, k:ticks } = candlesticks;
            let { o:open, h:high, l:low, c:close, v:volume, n:trades, i:interval, x:isFinal, q:quoteVolume, V:buyVolume, Q:quoteBuyVolume } = ticks;
            btc_price = close
            resolve(btc_price)
        })
    })
}

get_BTC_pairs = () => {
    return new Promise(resolve => {
        binance.exchangeInfo((error, data) => {
            if (error) {
                console.log( error )
                resolve([])
            }
            if (data) {
                console.log( data.symbols.length + " total pairs")
                resolve( data.symbols.filter( pair => pair.symbol.endsWith('BTC') ).map(pair=>pair.symbol) )
            }
        })
    })
}


get_candleSticks_for_BTC_pairs = async (interval) => {
    console.log(`Run on ${interval} chart`);
    for (var i = 0; i < pairs.length; i++) {
        await getPrevMinutePrices(pairs[i], interval);
        //await getPrevMinutePrices('GASBTC', interval);
        await sleep(wait_time)

        await trackPrice(pairs[i], interval);
        //await trackPrice('GASBTC', interval);
        await sleep(wait_time)
    }
}

getPrevMinutePrices = (pair, interval) => {
    return new Promise(resolve => {
        binance.candlesticks(pair, interval, (error, ticks, symbol) => {
            if (error) {
                console.log( pair + " getPrevMinutePrices ERROR " + error )
                resolve(true)
            }

            if (ticks) {
                console.log( pair + ' got data')
                for (var i = 0; i < ticks.length; i++) {
                    let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = ticks[i]
                    let data = createPairData(time, parseFloat(open), parseFloat(close), parseFloat(volume), parseFloat(buyBaseVolume), parseFloat(high), parseFloat(low));

                    if (!tracked_pairs[symbol]) {
                        // for 1st element
                        tracked_pairs[symbol] = [];
                        tracked_pairs[symbol].unshift(data);
                    } else {
                        tracked_pairs[symbol].unshift(data);
                    }
                }

                tracked_pairs[symbol] = rsi.calculatePrevGainLoss(tracked_pairs[symbol]);
                tracked_pairs[symbol] = ovb.calculatePreOVB(tracked_pairs[symbol]);

                handleIchimokuSignal(symbol);

                resolve(true)
            }
        }, {limit: 300})
    })
}

trackPrice = (pair, interval) => {
    return new Promise(resolve => {
        binance.websockets.candlesticks(pair, interval, (candlesticks) => {
            let { e:eventType, E:eventTime, s:symbol, k:ticks } = candlesticks;
            let { o:open, h:high, l:low, c:close, v:volume, n:trades, i:interval, x:isFinal, q:quoteVolume, V:buyBaseVolume, Q:quoteBuyVolume } = ticks;

            if (isFinal) {
                let data = createPairData(Date.now(), parseFloat(open), parseFloat(close), volume, buyBaseVolume, parseFloat(high), parseFloat(low));
                tracked_pairs[symbol].pop();
                tracked_pairs[symbol].unshift(data);

                let gainLoss = rsi.calculateCurrentGainLoss(tracked_pairs[symbol][1], tracked_pairs[symbol][0])
                tracked_pairs[symbol][0].avgGain = gainLoss.avgGain;
                tracked_pairs[symbol][0].avgLoss = gainLoss.avgLoss;
                tracked_pairs[symbol][0].ovb = ovb.calculateOVB(tracked_pairs[symbol][1], tracked_pairs[symbol][0]);

                handleIchimokuSignal(symbol);
            }

            resolve(true);
        });
    })
}


handleIchimokuSignal = (symbol) => {
    let chimokuElements = createIchimokuElements(symbol);
    var message = calculateIchimoku(symbol, chimokuElements.tenkanSen, chimokuElements.kijunSen, chimokuElements.senkouSpanA, chimokuElements.senkouSpanB, chimokuElements.chikouSpan);

    if (message) {
        if (tracked_pair_status[symbol] != message) {
            tracked_pair_status[symbol] = message;
            var a = new Date();
            message = `${message} ${symbol} at ${chimokuElements.chikouSpan}-${chimokuElements.kijunSen} \n ${a.getDate()}/${a.getMonth()}/${a.getFullYear()} ${a.getHours()}:${a.getMinutes()} \n`
            console.log(message);
            bot.sendMessage(chatId, message);
        }
    }
}

createPairData = (time, open, close, volume, buyBaseVolume, high, low) => {
    return {
        time: time,
        price: close,
        high: high,
        low: low,
        volume: volume,
        buyVolume: buyBaseVolume,
        close: close,
        open: open
    }
}

run()

const app = express()
app.get('/', (req, res) => res.send(tracked_pairs))
app.listen(9874, () => console.log('NBT api accessable on port 80'))
