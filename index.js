const express = require('express')
const app = express()
const ObjectId = require('mongodb').ObjectId
const { MongoClient } = require('mongodb');
const cors = require('cors')
const admin = require("firebase-admin");
require('dotenv').config();
const port = process.env.PORT || 5000;


// const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);

const serviceAccount = require('./car-faire-firebase-adminsdk.json')
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// middleware
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0shwc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

console.log(uri)

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}

async function run() {
    try {
        await client.connect()

        const database = client.db('car_fair')
        const carsCollection = database.collection('cars')
        const ordersCollection = database.collection('orders')
        const reviewsCollection = database.collection('reviews')
        const usersCollection = database.collection('users');
        console.log('database connect');


        // get all orders
        app.get('/cars', async (req, res) => {
            const cursor = carsCollection.find({})
            const result = await cursor.toArray()
            res.json(result)
        })

        // save orders info in database
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await ordersCollection.insertOne(order)
            res.json(result)
        })

        // all orders get
        app.get('/orders', async (req, res) => {
            const cursor = ordersCollection.find({})
            const result = await cursor.toArray()
            res.json(result)
        })

        // cancel specific order
        app.delete('/orders/:id', async (req, res) => {
            const order = req.params.id
            const filter = { _id: ObjectId(order) }
            const result = await ordersCollection.deleteOne(filter)
            res.json(result)
            console.log(order)
        })

        // specific user's orders
        app.get('/orders/:email', async (req, res) => {
            const email = req.params.email
            const filter = { email: email }
            const result = await ordersCollection.find(filter).toArray()
            res.json(result)
            console.log(result)
        })

        // store review 
        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review)
            res.json(result)
        })

        // get all reviews
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find({}).toArray()
            res.json(result)
        });
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        });
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });

        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' })
            }

        })

    }
    finally {
        // await client.close()
    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello car fair')
})

app.listen(port, () => {
    
    console.log('listening at the port', port)
})