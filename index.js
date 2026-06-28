const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
const app = express();

dotenv.config();
app.use(express.json());
app.use(cors());

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL_FOR_JWT}/api/auth/jwks`)
)
const verifyToken = async(req, res, next) => {
  const tokenData = req.headers.authorization;

  if (!tokenData) {
    return res.status(401).json({ message: 'Unauthorized' });
  };
  const token = tokenData.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  };

  try{
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;  // sent payload to req.user
    next();
  }
  catch (error) {
    return res.status(403).json({ message: 'Forbidden' });
  }
};

// artist verification
const verifyArtist = async(req, res, next) =>{
  const user = req.user;
  if(user?.role !== 'artist'){
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

// admin verification
const verifyAdmin = async(req, res, next) =>{
  const user = req.user;
  if(user?.role !== 'admin'){
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

// buyer verification
const verifyBuyer = async(req, res, next) =>{
  const user = req.user;
  if(user?.role !== 'buyer'){
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};


const uri = process.env.MONGODB_URI;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const ArtHubDB = client.db('ArtHub');
    const artWorksCollection = ArtHubDB.collection('artworks');
    const paymentsCollection = ArtHubDB.collection('payments');
    const plansCollection = ArtHubDB.collection('plans');
    const purchasesCollection = ArtHubDB.collection('purchases');
    const userCollection = ArtHubDB.collection('user');
    const commentCollection = ArtHubDB.collection('comment');


    // ARTIST OPERATIONS API's

    // get artist payments history by artist id
    app.get('/api/artist/sales', verifyToken, verifyArtist, async (req, res) => {
      const { artistId, page = 1, limit = 11 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const result = await paymentsCollection.find({ artistId: artistId, type: 'payment' }).skip(skip).limit(Number(limit)).toArray();
      const totalData = await paymentsCollection.countDocuments({ artistId: artistId, type: 'payment' });
      // all result for overview page data 
      const resultAll = await paymentsCollection.find({ artistId: artistId, type: 'payment' }).sort({ createAt: -1 }).toArray();
      const totalPage = Math.ceil(totalData / Number(limit));
      res.json({ data: result, page: Number(page), totalPage, resultAll: resultAll });
    });
    // create artwork by artist 
    app.post('/api/artists', verifyToken, verifyArtist, async (req, res) => {
      const data = req.body;
      const newArtwork = {
        ...data,
        createAt: new Date(),
      }
      const result = await artWorksCollection.insertOne(newArtwork);
      res.json(result);
    });
    // get artworks by artist id
    app.get('/api/my/artwork', verifyToken, verifyArtist, async (req, res) => {
      const { artistId, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const result = await artWorksCollection.find({ artistId: artistId }).skip(skip).limit(Number(limit)).toArray();
      const totalData = await artWorksCollection.countDocuments({ artistId: artistId });
      const allArtwork = await artWorksCollection.find({ artistId: artistId }).sort({ createAt: -1 }).toArray();
      const totalPage = Math.ceil(totalData / Number(limit));
      res.json({ data: result, page: Number(page), totalPage, totalData, allArtwork: allArtwork });
    })
    // delete artwork
    app.delete('/api/artwork/:id', verifyToken, verifyArtist, async (req, res) => {
      const { id } = req.params;
      const result = await artWorksCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });
    // update artwork by artist
    app.patch('/api/artwork/:id', verifyToken, verifyArtist, async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      const result = await artWorksCollection.updateOne({ _id: new ObjectId(id) }, { $set: data });
      res.json(result);
    });
  //get artwork for feature section 
  app.get('/api/artwork/features', async(req, res)=>{
    const result = await artWorksCollection.find().toArray()
     res.json(result)
  })
    // get artworks
    app.get('/api/artwork', async (req, res) => {
      const { search, minPrice, maxPrice, category, sort, page = 1, limit = 12 } = req.query;
      let query = {};

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { artist: { $regex: search, $options: 'i' } },
        ]
      };
      if (minPrice) query.price = { $gte: Number(minPrice) };
      if (maxPrice) query.price = { $lte: Number(maxPrice) };
      if (category && category !== 'All') {
        query.category = category;
      }

      let sortOption = {};
      if (sort === 'Latest') {
        sortOption = { createAt: -1 }
      } else if (sort === 'Oldest') {
        sortOption = { createAt: 1 }
      } else if (sort === 'Price Low-High') {
        sortOption = { price: 1 }
      } else if (sort === 'Price High-Low') {
        sortOption = { price: -1 }
      }

      const skip = (Number(page) - 1) * Number(limit);
      const result = await artWorksCollection.find(query).skip(skip).limit(Number(limit)).sort(sortOption).toArray();
      const totalData = await artWorksCollection.countDocuments(query);
      const totalPage = Math.ceil(totalData / Number(limit));
      res.json({ data: result, page: Number(page), totalPage });
    });
    //get artwork by id
    app.get('/api/artwork/:id', async (req, res) => {
      const { id } = req.params;
      const result = await artWorksCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    //get buy artwork by user id
    app.get('/api/purchases', verifyToken, verifyBuyer, async (req, res) => {
      const { userId, page = 1, limit = 6 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const result = await purchasesCollection.find({ buyerId: userId }).skip(skip).limit(Number(limit)).toArray();
      const totalData = await purchasesCollection.countDocuments({ buyerId: userId });
      const totalPage = Math.ceil(totalData / Number(limit));
      res.json({ data: result, page: Number(page), totalPage });
    });
    // get my total purchase for overview page buyer maybe 
    app.get('/api/purchases/total', verifyToken, verifyBuyer, async (req, res) => {
      const { userId } = req.query;
      const result = await purchasesCollection.find({ buyerId: userId }).toArray();
      res.json(result);
    });
    // PAYMENTS RELATED API
    app.post('/api/payments', verifyToken, verifyBuyer, async (req, res) => {
      const data = req.body;
      const { sessionId, customerEmail, type, amount, artistName, artworkName, artworkId, image, artistId, buyerId, buyerName } = data;

      const existingPayment = await paymentsCollection.findOne({ sessionId });
      if (existingPayment) {
        return
      }
      // purchases
      const purchaseObj = {
        image,
        artworkName,
        artworkId,
        buyerId,
        customerEmail,
      }
      await purchasesCollection.insertOne(purchaseObj);

      // history 
      const newPayment = {
        artistId,
        artistName,
        artworkName,
        buyerId,
        buyerName,
        amount,
        sessionId,
        type,
        customerEmail,
        createAt: new Date(),
      }
      await paymentsCollection.insertOne(newPayment);
    });

    // subscriptions
    app.post('/api/subscriptions', verifyToken, verifyBuyer, async (req, res) => {
      const data = req.body;
      const userId = data.buyerId;
      const sessionId = data.sessionId;
      const existingPayment = await paymentsCollection.findOne({ sessionId });
      if (existingPayment) {
        return
      }

      const filter = ({ _id: new ObjectId(userId) });
      const updateDocument = {
        $set: {
          plan: data.priceId,
        }
      }
      await userCollection.updateOne(filter, updateDocument);

      const newSubscription = {
        ...data,
        createAt: new Date(),
      }
      await paymentsCollection.insertOne(newSubscription);
    });

    // get payments history by buyer id
    app.get('/api/payments',verifyToken, verifyBuyer, async (req, res) => {
      const { userId, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const result = await paymentsCollection.find({ buyerId: userId, type: 'payment' }).sort({ createAt: -1 }).skip(skip).limit(Number(limit)).toArray();

      const totalData = await paymentsCollection.countDocuments({ buyerId: userId, type: 'payment' })
      const totalPage = Math.ceil(totalData / Number(limit));

      res.json({ data: result, page: Number(page), totalPage });
    });
//COMMENTS API
  app.post("/api/user/comment", verifyToken, async(req, res)=>{
    console.log(req.user)
    try{
      const data = req.body;
      const { artWorkId } = req.query;
      const { userId, artworkId, comment, userName } = data;
      const buyExist = await purchasesCollection.findOne({ artworkId: artWorkId,  buyerId: req.user.id });

      if(!buyExist){
        return res.status(400).json({
          success: false,
          message: 'Artwork not found',
        });
      }
      
      const commentObj = {
        userId,
        artworkId,
        comment,
        userName,
        createAt: new Date(),
      }
      const result = await commentCollection.insertOne(commentObj);
      res.status(200).json({
        result,
        success: true,
        message: 'Comment added successfully',
      });
      
    }catch(error){
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error,
      });
    }
  });

// get comments 
app.get('/api/user/comment', verifyToken, async(req, res)=>{
  const {artworkId} = req.query;
  const result = await commentCollection.find({ artworkId: artworkId }).sort({createAt: -1}).toArray();
  res.json(result);
});
// user artwork purchase or not check
app.get('/api/user/purchaseProved',verifyToken, async(req, res)=>{
  const {userId, artworkId} = req.query;
  const purchaseExist = await purchasesCollection.findOne({artworkId, buyerId: userId})
  console.log(purchaseExist)
  res.json(purchaseExist)
});
// delete comment by userId
app.delete('/api/user/comment/:id',verifyToken, async(req, res)=>{
  try{
  const {id} = req.params;
  const result = await commentCollection.deleteOne({_id: new ObjectId(id), userId: req.user.id})
  res.json({result, success: true, message: 'Comment deleted successfully'})
  }catch(error){
    res.status(500).json({
      success: false,
      message: 'Something went wrong',
      error,
    });
  } 
});
// update comment by userId
app.patch('/api/user/comment/:id',verifyToken, async(req, res)=>{
  try{
  const {id} = req.params;
  const data = req.body;
  const filter = {_id: new ObjectId(id), userId: req.user.id};
  const updateDocument = {
    $set:{
      comment: data.comment,
    }
  }
  const result = await commentCollection.updateOne(filter, updateDocument)
  res.json({result, success: true, message: 'Comment updated successfully'})
  }catch(error){
    res.status(500).json({
      success: false,
      message: 'Something went wrong',
      error,
    });
  } 
});

    // ADMIN CONSTRUCTOR API 
    // admin get all users
    app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
      const { role, page = 1, limit = 10 } = req.query;

      if (role !== 'admin') {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const skip = (Number(page) - 1) * Number(limit);
      const result = await userCollection.find().skip(skip).limit(Number(limit)).toArray();
      const totalData = await userCollection.countDocuments();
      const totalPage = Math.ceil(totalData / Number(limit));
      res.json({ data: result, page: Number(page), totalPage });
    });

    // admin get all users transactions
    app.get('/api/admin/transactions', verifyToken, verifyAdmin, async (req, res) => {
      const { role, page = 1, limit = 11 } = req.query;
      if (role !== 'admin') {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const skip = (Number(page) - 1) * Number(limit);
      const result = await paymentsCollection.find().sort({ createAt: -1 }).skip(skip).limit(Number(limit)).toArray();
      const totalData = await paymentsCollection.countDocuments();
      const totalPage = Math.ceil(totalData / Number(limit));
      res.json({ data: result, page: Number(page), totalPage });
    });
    // admin get all artwork 
    app.get('/api/admin/artworks', verifyToken, verifyAdmin, async (req, res) => {
      const { role, page = 1, limit = 11 } = req.query;
      if (role !== 'admin') {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const skip = (Number(page) - 1) * Number(limit);
      const result = await artWorksCollection.find().sort({ createAt: -1 }).skip(skip).limit(Number(limit)).toArray();
      const totalData = await artWorksCollection.countDocuments();
      const totalPage = Math.ceil(totalData / Number(limit));
      res.json({ data: result, page: Number(page), totalPage });
    });
    // admin delete artwork
    app.delete('/api/admin/artwork/:id', verifyToken, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const result = await artWorksCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });
    // get admin pie chart data
    app.get('/api/admin/pie', verifyToken, verifyAdmin, async (req, res) => {
      const result = await artWorksCollection.aggregate([
        {
          $group: {
            _id: "$category",
            value: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            name: "$_id",
            value: 1
          }
        }
      ]).toArray();
      res.json(result);
    })
  // admin get all sold artworks
  app.get('/api/admin/sold', verifyToken, verifyAdmin, async (req, res) => {
    const result = await purchasesCollection.find().toArray();
    res.json(result);
  })
// get total payments data
  app.get('/api/admin/payments', verifyToken, verifyAdmin, async (req, res) => {
    const result = await paymentsCollection.find().toArray();
    const totalRevenue = result.reduce((total, sale)=> total + Number(sale.amount), 0);
    res.json(totalRevenue);
  })
    //PLANS RELATED API
    app.get('/api/plans', async (req, res) => {
      const plan = req.query.plan;
      const result = await plansCollection.findOne({ plan_id: plan });
      res.json(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Hello World');
});
app.listen(process.env.PORT, () => {
  console.log('Server is running on port 5000');
});