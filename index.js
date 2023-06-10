const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const jwt = require("jsonwebtoken");

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

    // class api
    app.get("/class", async (req, res) => {
      const result = await classCollection.find().limit(6).toArray();

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
