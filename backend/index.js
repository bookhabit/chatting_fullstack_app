const express = require('express');
const mongoose = require('mongoose');

const app = express();

app.get('/test', (req,res) => {
    res.json('test ok2');
});

app.listen(4000)