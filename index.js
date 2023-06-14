const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

app.use(cors());
app.use(express.json());

// verify jwt token

const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(403).send({ message: "Invalid authorization" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Invalid authorization" });
    }

    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.78xjoll.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();

    const classCollection = client.db("summercamp").collection("class");
    const usersCollection = client.db("summercamp").collection("users");
    const cartsCollection = client.db("summercamp").collection("carts");
    const feedBackCollection = client.db("summercamp").collection("feedback");
    const paymentCollection = client.db("summercamp").collection("payment");
    const paidClassCollection = client.db("summercamp").collection("paidClass");
    const paidInstructorClassCollection = client
      .db("summercamp")
      .collection("paidClassInstructor");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      next();
    };
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      next();
    };

    // jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const jwtToken = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "78h",
      });
      res.send({ jwtToken });
    });

    // app.put("/payment/:id", verifyToken, async (req, res) => {
    //   const payment = req.body;
    //   const id = req.params.id;
    //   const options = { upsert: true };
    //   const filter = { _id: new ObjectId(id) };
    //   const existingItem = await classCollection.findOne(filter);
    //   const updatedDoc = {
    //     $inc: {
    //       students: +1,
    //       availableSeats: -1,
    //     },
    //   };
    //   const updatedResult = await classCollection.updateOne(
    //     filter,
    //     updatedDoc,
    //     options
    //   );
    //   const query = {
    //     // _id: { $in: payment.cartItems.map((id) => new ObjectId(id)) },
    //   };
    //   const insertResult = await paymentCollection.insertOne(payment);

    //   const deletedResult = await cartsCollection.deleteOne(filter);
    //   res.send({
    //     insertResult,
    //     deletedResult,
    //     updatedResult,
    //     // updatedStudents,
    //     // updatedAvailabeSeats,
    //   });
    // });

    app.put("/payment/:id", verifyToken, async (req, res) => {
      const payment = req.body;
      const id = req.params.id;
      //   const options = { upsert: true };

      const queryTwo = { _id: new ObjectId(id) };
      const paidInstructor = await classCollection.findOne({
        _id: new ObjectId(id),
      });
      const paidInstructorClass = await paidInstructorClassCollection.insertOne(
        paidInstructor
      );

      const paidClass = await cartsCollection.findOne({ classId: id });
      const paidClassInserted = await paidClassCollection.insertOne(paidClass);

      const deletedResult = await cartsCollection.deleteOne({ classId: id });
      const insertedResult = await paymentCollection.insertOne(payment);
      //   const updatedClass = await classCollection.updateOne(queryTwo, {
      //     $inc: { students: 1, availableSeats: -1 },
      //   });
      res.send({ insertedResult, deletedResult });
      //   paidClass?.availabeSeats +=1;
      //   paidClass?.students -=1;
      //   const updatedDoc = {
      //     $inc: {
      //       updatedStudents,
      //       updatedAvailableSeats,
      //     },
      //   };

      //   const updatedDoc = {
      //     $inc: { students: 1 },
      //     $set: { availableSeats: { $subtract: ["$availableSeats", 1] } },
      //   };
      //   const updatedClass = await classCollection.updateOne(
      //     queryTwo,
      //     updatedDoc
      //   );
      //   Update the class document in classCollection

      //   console.log(updatedClass);
    });

    app.get("/mypayment/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await paymentCollection
        .find({ email: email })
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });
    app.get("/myenrolled/:id", async (req, res) => {
      const { id } = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.findOne(query);
      res.send(result);
    });

    app.get("/paidclass/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await paidClassCollection
        .find({ student: email })
        .toArray();
      res.send(result);
    });

    app.get("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { classId: id };
      const result = await cartsCollection.findOne(query);
      res.send(result);
    });

    // class api
    app.get("/class", async (req, res) => {
      const result = await classCollection
        .find({ status: "approved" })
        .limit(6)
        .toArray();

      result.map((course) => {
        course.students = parseFloat(course.students);
      });

      const sortedData = result.sort((a, b) => {
        const studentsA = a.students;
        const studentsB = b.students;
        return studentsB - studentsA;
      });

      res.send(sortedData);
    });

    app.get("/allclasses", async (req, res) => {
      const result = await classCollection
        .find({ status: "approved" })
        .toArray();
      res.send(result);
    });

    app.get("/allclass", verifyToken, verifyAdmin, async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    app.delete("/deleteclass/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.deleteOne(query);
      res.send(result);
    });
    app.post("/allclasses", verifyToken, verifyInstructor, async (req, res) => {
      const newItem = req.body;
      const query = { _id: newItem._id };
      const existingItem = await classCollection.findOne(query);
      if (existingItem) {
        return res.send({ message: "already exist" });
      }
      const result = await classCollection.insertOne(newItem);
      res.send(result);
    });

    app.get(
      "/myclass/:email",
      verifyToken,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;

        const query = { email: email };
        const result = await classCollection.find(query).toArray();
        res.send(result);
      }
    );

    app.get("/feedback/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);
      console.log(result);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      //   const userRole = req.params.role;

      //   const query = { role: userRole };
      const result = await usersCollection
        .find({ role: "instructor" })
        .toArray();
      res.send(result);
    });

    app.get("/allusers", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.put("/class/deny/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: "deny",
        },
      };
      const result = await classCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    app.put(
      "/class/approve/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            status: "approved",
          },
        };
        const result = await classCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.send(result);
      }
    );

    // users api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user alredy in the data base" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.delete(
      "/deleteuser/:email",
      verifyToken,

      async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const result = await usersCollection.deleteOne(query);
        res.send(result);
      }
    );

    app.put("/user/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    app.put("/user/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };

      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      const query = { email: email };
      if (email !== req.decoded.email) {
        res.send({ admin: false });
      }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role == "admin" };
      res.send(result);
    });
    app.get("/user/instructor/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      const query = { email: email };
      if (email !== req.decoded.email) {
        res.send({ admin: false });
      }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role == "instructor" };
      res.send(result);
    });
    // cart apis

    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartsCollection.insertOne(item);
      res.send(result);
    });

    app.get("/cart", verifyToken, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.send([]);
      }
      if (req.decoded.email !== email) {
        return res.status(403).send({ message: "Invalid email" });
      }
      const result = await cartsCollection.find({ student: email }).toArray();
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      console.log(price);
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/feedback", verifyToken, verifyAdmin, async (req, res) => {
      const feedback = req.body;
      const result = await feedBackCollection.insertOne(feedback);
      res.send(result);
    });

    app.put("/deniedfeedback", async (req, res) => {
      const feedback = req.body;
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          feedback: feedback,
        },
      };

      const result = await classCollection.updateOne(
        feedback,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.get("/feedback", verifyToken, verifyInstructor, async (req, res) => {
      const email = req.query.email;

      const result = await feedBackCollection.find({ email: email }).toArray();
      res.send(result);
    });

    app.get(
      "/paidInstructor/:email",
      verifyToken,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        const result = await paidInstructorClassCollection
          .find({ email: email })
          .toArray();
        res.send(result);
      }
    );

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("summer camp server is running");
});

app.listen(port, () => {
  console.log(`listening on ${port}`);
});
