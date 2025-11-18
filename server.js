const express = require('express')
const app = express()
const cors = require('cors')
const port = 3000

app.use(cors())

app.get('/', (req, res) => {
    console.log("We're in the / GET request")
    res.status(200).json({
        message: "Hello World!"
    })
})

app.listen(3000)