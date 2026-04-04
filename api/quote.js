{\rtf1\ansi\ansicpg936\cocoartf2869
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fnil\fcharset0 Menlo-Regular;}
{\colortbl;\red255\green255\blue255;\red77\green80\blue85;\red236\green241\blue247;\red0\green0\blue0;
\red111\green14\blue195;\red24\green112\blue43;\red164\green69\blue11;\red14\green110\blue109;}
{\*\expandedcolortbl;;\cssrgb\c37255\c38824\c40784;\cssrgb\c94118\c95686\c97647;\cssrgb\c0\c0\c0;
\cssrgb\c51765\c18824\c80784;\cssrgb\c9412\c50196\c21961;\cssrgb\c70980\c34902\c3137;\cssrgb\c0\c50196\c50196;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\pardeftab720\partightenfactor0

\f0\fs28 \cf2 \cb3 \expnd0\expndtw0\kerning0
\outl0\strokewidth0 \strokec2 // api/quote.js\cf0 \cb1 \strokec4 \
\cf2 \cb3 \strokec2 // \uc0\u38024 \u23545  Vercel \u20248 \u21270 \u30340  Serverless Function\cf0 \cb1 \strokec4 \
\pard\pardeftab720\partightenfactor0
\cf5 \cb3 \strokec5 const\cf0 \strokec4  yahooFinance = require(\cf6 \strokec6 'yahoo-finance2'\cf0 \strokec4 ).\cf5 \strokec5 default\cf0 \strokec4 ;\cb1 \
\
\pard\pardeftab720\partightenfactor0
\cf0 \cb3 module.exports = \cf5 \strokec5 async\cf0 \strokec4  (req, res) => \{\cb1 \
\cb3     \cf2 \strokec2 // \uc0\u20801 \u35768 \u36328 \u22495  (\u34429 \u28982 \u21516 \u28304 \u37096 \u32626 \u19981 \u38656 \u35201 \u65292 \u20294 \u21152 \u19978 \u26356 \u20445 \u38505 )\cf0 \cb1 \strokec4 \
\cb3     res.setHeader(\cf6 \strokec6 'Access-Control-Allow-Credentials'\cf0 \strokec4 , \cf5 \strokec5 true\cf0 \strokec4 );\cb1 \
\cb3     res.setHeader(\cf6 \strokec6 'Access-Control-Allow-Origin'\cf0 \strokec4 , \cf6 \strokec6 '*'\cf0 \strokec4 );\cb1 \
\cb3     res.setHeader(\cf6 \strokec6 'Access-Control-Allow-Methods'\cf0 \strokec4 , \cf6 \strokec6 'GET,OPTIONS'\cf0 \strokec4 );\cb1 \
\
\cb3     \cf5 \strokec5 if\cf0 \strokec4  (req.method === \cf6 \strokec6 'OPTIONS'\cf0 \strokec4 ) \{\cb1 \
\cb3         res.status(\cf7 \strokec7 200\cf0 \strokec4 ).end();\cb1 \
\cb3         \cf5 \strokec5 return\cf0 \strokec4 ;\cb1 \
\cb3     \}\cb1 \
\
\cb3     \cf2 \strokec2 // \uc0\u33719 \u21462 \u21069 \u31471 \u20256 \u26469 \u30340 \u32929 \u31080 \u20195 \u30721 \u65292 \u40664 \u35748 \u20026  TSLA\u65292 \u24182 \u21435 \u38500 \u21487 \u33021 \u23384 \u22312 \u30340  US. \u21069 \u32512 \cf0 \cb1 \strokec4 \
\cb3     \cf5 \strokec5 let\cf0 \strokec4  \cf5 \strokec5 symbol\cf0 \strokec4  = req.query.code || \cf6 \strokec6 'TSLA'\cf0 \strokec4 ;\cb1 \
\cb3     \cf5 \strokec5 symbol\cf0 \strokec4  = \cf5 \strokec5 symbol\cf0 \strokec4 .replace(\cf6 \strokec6 'US.'\cf0 \strokec4 , \cf6 \strokec6 ''\cf0 \strokec4 );\cb1 \
\
\cb3     \cf5 \strokec5 try\cf0 \strokec4  \{\cb1 \
\cb3         console.log(\cf6 \strokec6 `[Vercel API] Fetching data for: \cf0 \strokec4 $\{\cf5 \strokec5 symbol\cf0 \strokec4 \}\cf6 \strokec6 `\cf0 \strokec4 );\cb1 \
\cb3         \cb1 \
\cb3         \cf2 \strokec2 // \uc0\u24182 \u21457 \u35831 \u27714 \u34892 \u24773 \u21644 \u21382 \u21490 \u25968 \u25454 \u65292 \u25552 \u21319 \u21709 \u24212 \u36895 \u24230 \cf0 \cb1 \strokec4 \
\cb3         \cf5 \strokec5 const\cf0 \strokec4  [quote, history] = \cf5 \strokec5 await\cf0 \strokec4  \cf8 \strokec8 Promise\cf0 \strokec4 .all([\cb1 \
\cb3             yahooFinance.quote(\cf5 \strokec5 symbol\cf0 \strokec4 ),\cb1 \
\cb3             yahooFinance.historical(\cf5 \strokec5 symbol\cf0 \strokec4 , \{ period1: \cf6 \strokec6 '2023-01-01'\cf0 \strokec4 , interval: \cf6 \strokec6 '1d'\cf0 \strokec4  \})\cb1 \
\cb3         ]);\cb1 \
\
\cb3         \cf2 \strokec2 // \uc0\u26684 \u24335 \u21270 \u25968 \u25454 \u20197 \u21305 \u37197 \u21069 \u31471  TradeFlow \u30340 \u20005 \u26684 \u35201 \u27714 \cf0 \cb1 \strokec4 \
\cb3         \cf5 \strokec5 const\cf0 \strokec4  formattedData = \{\cb1 \
\cb3             \cf5 \strokec5 symbol\cf0 \strokec4 : \cf5 \strokec5 symbol\cf0 \strokec4 ,\cb1 \
\cb3             price: quote.regularMarketPrice,\cb1 \
\cb3             changePercent: quote.regularMarketChangePercent,\cb1 \
\cb3             prevClose: quote.regularMarketPreviousClose,\cb1 \
\cb3             dayOpen: quote.regularMarketOpen,\cb1 \
\cb3             dayHigh: quote.regularMarketDayHigh,\cb1 \
\cb3             dayLow: quote.regularMarketDayLow,\cb1 \
\cb3             \cf2 \strokec2 // \uc0\u25552 \u21462  OHLC \u21382 \u21490 \u25968 \u25454 \u20379 \u21069 \u31471 \u22270 \u34920 \u28210 \u26579 \cf0 \cb1 \strokec4 \
\cb3             history: history.map(h => (\{\cb1 \
\cb3                 time: h.date.toISOString().split(\cf6 \strokec6 'T'\cf0 \strokec4 )[\cf7 \strokec7 0\cf0 \strokec4 ],\cb1 \
\cb3                 open: h.open,\cb1 \
\cb3                 high: h.high,\cb1 \
\cb3                 low: h.low,\cb1 \
\cb3                 close: h.close,\cb1 \
\cb3                 volume: h.volume\cb1 \
\cb3             \})).slice(-\cf7 \strokec7 100\cf0 \strokec4 ) \cf2 \strokec2 // \uc0\u21462 \u26368 \u36817  100 \u20010 \u20132 \u26131 \u26085 \cf0 \cb1 \strokec4 \
\cb3         \};\cb1 \
\
\cb3         \cf2 \strokec2 // \uc0\u25104 \u21151 \u36820 \u22238  JSON\cf0 \cb1 \strokec4 \
\cb3         res.status(\cf7 \strokec7 200\cf0 \strokec4 ).json(formattedData);\cb1 \
\cb3         \cb1 \
\cb3     \} \cf5 \strokec5 catch\cf0 \strokec4  (error) \{\cb1 \
\cb3         console.error(\cf6 \strokec6 `[Vercel API] Error fetching data for \cf0 \strokec4 $\{\cf5 \strokec5 symbol\cf0 \strokec4 \}\cf6 \strokec6 :`\cf0 \strokec4 , error);\cb1 \
\cb3         res.status(\cf7 \strokec7 500\cf0 \strokec4 ).json(\{ \cb1 \
\cb3             error: \cf6 \strokec6 "Failed to fetch stock data"\cf0 \strokec4 , \cb1 \
\cb3             details: error.message \cb1 \
\cb3         \});\cb1 \
\cb3     \}\cb1 \
\cb3 \};\cb1 \
}