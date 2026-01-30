var db = require("../config/connection");
var collection = require("../config/collection");
const bcrypt = require("bcryptjs");
const { request, response } = require("../app");
const { ObjectId } = require("mongodb");

module.exports = {
 doSignup: (userData) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!userData.password || !userData.Email) {
        return reject(new Error("Email and password are required"));
      }

      const userCollection = db.get().collection(collection.USER_COLLECTION);

      
      const existingUser = await userCollection.findOne({
        Email: userData.Email
      });

      if (existingUser) {
        return reject({ message: "Account already exists" });
      }

      userData.password = await bcrypt.hash(userData.password, 10);
      const userdata ={
      Email:userData.Email,
      password:userData.password,
      role:'user',
      createAt: new Date()
      };
      const result = await userCollection.insertOne(userdata);
      resolve(result.insertedId);

    } catch (err) {
      reject(err);
    }
  });
},
doLogin: (userData) => {
  return new Promise(async (resolve) => {
    const user = await db
      .get()
      .collection(collection.USER_COLLECTION)
      .findOne({ Email: userData.Email });

    if (!user) {
      return resolve({ status: false });
    }

    const status = await bcrypt.compare(userData.password, user.password);

    if (status) {
      resolve({ user, status: true });
    } else {
      resolve({ status: false });
    }
  });
},
  generateOTP: (Email) => {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Check if user exists
      let user = await db.get().collection(collection.USER_COLLECTION).findOne({ Email: Email });
      if (!user) return resolve({ status: false, message: "User not found" });

      // 2. Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 3. Set Expiry (e.g., 5 minutes from now)
      const expiry = new Date(Date.now() + 15 * 60000);

      // 4. Update user record with OTP and Expiry
      await db.get().collection(collection.USER_COLLECTION).updateOne(
        { Email: Email },
        { 
          $set: { 
            resetOTP: otp, // In production, hash this with bcrypt!
            otpExpiry: expiry 
          } 
        }
      );

      resolve({ status: true, otp: otp }); // Send OTP back to the route to email it
    } catch (err) {
      reject(err);
    }
  });
},
verifyAndResetPassword: (details) => {
  return new Promise(async (resolve, reject) => {
    try {
      let { Email, otp, newPassword } = details;
      
      // 1. Find user with matching Email and valid (non-expired) OTP
      let user = await db.get().collection(collection.USER_COLLECTION).findOne({
        Email: Email.trim(),
        resetOTP: otp.trim(),
        otpExpiry: { $gt: new Date() } // Checks if current time is less than expiry
      });

      if (user) {
        // 2. Hash the new password
        let hashedNamePassword = await bcrypt.hash(newPassword, 10);

        // 3. Update password and clear the OTP fields
        await db.get().collection(collection.USER_COLLECTION).updateOne(
          { Email: Email },
          { 
            $set: { password: hashedNamePassword },
            $unset: { resetOTP: "", otpExpiry: "" } // Remove OTP fields after use
          }
        );
        resolve({ status: true });
      } else {
        resolve({ status: false, message: "Invalid or expired OTP" });
      }
    } catch (err) {
      reject(err);
    }
  });
},


  addToCart: (proId, userId) => {
    let proObj = {
      item: new ObjectId(proId),
      quantity: 1,
    };
    return new Promise(async (resolve, reject) => {
      try {
        let userCart = await db
          .get()
          .collection(collection.CART_COLLECTION)
          .findOne({ user: new ObjectId(userId) });
        if (userCart) {
          let proExist = userCart.products.findIndex((product) =>
            product.item.equals(new ObjectId(proId))
          );
          if (proExist != -1) {
            // Increment the quantity of the existing product
            await db
              .get()
              .collection(collection.CART_COLLECTION)
              .updateOne(
                { user: new ObjectId(userId), "products.item": new ObjectId(proId) },
                { $inc: { "products.$.quantity": 1 } }
              );
          } else {
            // Add the new product to the cart
            await db
              .get()
              .collection(collection.CART_COLLECTION)
              .updateOne(
                { user: new ObjectId(userId) },
                { $push: { products: proObj } }
              );
          }
        } else {
          // Create a new cart for the user
          let cartObj = {
            user: new ObjectId(userId),
            products: [proObj],
          };
          await db.get().collection(collection.CART_COLLECTION).insertOne(cartObj);
        }
        resolve();
      } catch (err) {
        console.error("Error in addToCart:", err);
        reject(err);
      }
    });
  },

  getcartProduct: (userId) => {
    return new Promise(async (resolve, reject) => {
    
        let cartItems = await db
          .get()
          .collection(collection.CART_COLLECTION)
          .aggregate([
            {
              $match: { user: new ObjectId(userId) },
            },
            {
                $unwind: "$products"
            },
            {
                $project:{
                    item:'$products.item',
                    quantity:'$products.quantity'
                }
            },
            {
                $lookup:{
                    from:collection.PRODUCT_COLLECTION,
                    localField: 'item',
                    foreignField:'_id',
                    as:'product'
                }
            },
            {
              $project:{
                item:1,quantity:1,product:{$arrayElemAt:['$product',0]}
              }
            }
           
          ])
          .toArray();
          
       
        resolve(cartItems);
       
    });
  },

  getCartCount: (userId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let count = 0;
        let cart = await db
          .get()
          .collection(collection.CART_COLLECTION)
          .findOne({ user: new ObjectId(userId) });
        if (cart) {
          count = cart.products.length; // Count the number of products in the cart
        }
        resolve(count);
      } catch (err) {
        console.error("Error in getCartCount:", err);
        reject(err);
      }
    });
  },
  changeProductQuantity: (details) => {
    details.count=parseInt(details.count)
    details.quantity=parseInt(details.quantity)
    return new Promise(async (resolve, reject) => {
          if(details.count==-1 && details.quantity==1){

          db.get().collection(collection.CART_COLLECTION).updateOne({_id:new ObjectId(details.cart)},
            {
              $pull:{products:{item:new ObjectId(details.product)}}
            }
        ).then((response)=>{

          resolve({removeProduct:true})
          
        })
      }
      else{
        db.get().collection(collection.CART_COLLECTION).updateOne({_id: new ObjectId(details.cart),'products.item':new ObjectId(details.product)},
          {
            $inc:{'products.$.quantity':details.count}
          }).then((response)=>{
            resolve({status:true})
          })
      }
            
    });
  },
  removeFromCart:(details)=>{
  
  return new Promise((resolve, reject) => {
    db.get().collection(collection.CART_COLLECTION).updateOne({ _id: new ObjectId(details.cart) },
        {
          $pull: { products: { item: new ObjectId(details.product) } },
        }
      )
      .then((response) => {
        resolve({ removeProduct: true });
      })
      .catch((err) => {
        console.error("Error in removeFromCart:", err);
        reject(err);
      });
  });
},

getTotalAmount:(userId)=>{
  return new Promise(async(resolve,reject)=>{
    let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
            {
              $match: { user: new ObjectId(userId) },
            },
            {
                $unwind: "$products"
            },
            {
                $project:{
                    item:'$products.item',
                    quantity:'$products.quantity'
                }
            },
            {
                $lookup:{
                    from:collection.PRODUCT_COLLECTION,
                    localField: 'item',
                    foreignField:'_id',
                    as:'product'
                }
            },
            {
              $project:{
                item:1,quantity:1,product:{$arrayElemAt:['$product',0]}
              }
            },
            {
              $group:{
                _id:null,
                total:{ $sum:{$multiply:['$quantity','$product.Price']}}
               }
             }
           
          ]).toArray();
          
        if (total && total.length > 0) {
           resolve(total[0].total);
       } else {
         resolve(0);
       }
       
    });
},
placeOrder:async(order,products,total)=>{

  return new Promise((resolve, reject) => {
    console.log(order,products,total);
    let status=order['Payment']==='COD'?'placed':'pending'
    let orderObj={
      deliveryDetails:{
        mobile:order.mobile,
        address:order.address,
        pincode:order.pincode
      },
      userId:new ObjectId(order.userId),
      paymentMethod:order['Payment'],
      products:products,
      totalAmount:total,
      status:status,
      date:new Date()
    }
    db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response)=>{ 
      db.get().collection(collection.CART_COLLECTION).deleteOne({user:new ObjectId(order.userId)})
      resolve({orderId:response.insertedId})
    })
  });
},
getCartProductList:(userId)=>{
  return new Promise(async(resolve,reject)=>{
    let cart=await db.get().collection(collection.CART_COLLECTION).findOne({user:new ObjectId(userId)})
    console.log(cart);
    resolve(cart.products)  
})
},
getUserOrders:(userId)=>{
  return new Promise(async(resolve,reject)=>{
    let orders=await db.get().collection(collection.ORDER_COLLECTION).find({userId:new ObjectId(userId)}).toArray()
    console.log(orders);
    resolve(orders)
  })
},
getOrderProducts: (orderId) => {
  return new Promise(async (resolve, reject) => {
    try {
      let orderItems = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
        {
          $match: { _id: new ObjectId(orderId) }
        },
        {
          $unwind: '$products'
        },
        {
          $project: {
            item: '$products.item',
            quantity: '$products.quantity'
          }
        },
        {
          $lookup: {
            from: collection.PRODUCT_COLLECTION,
            localField: 'item',
            foreignField: '_id',
            as: 'product'
          }
        },
        {
          $project: {
            item: 1,
            quantity: 1,
            product: { $arrayElemAt: ['$product', 0] }
          }
        }
      ]).toArray();
      console.log(orderItems);
      resolve(orderItems);
    } catch (err) {
      console.error("Error in getOrderProducts:", err);
      reject(err);
    }
  });
},

};
