var express = require('express');
var router = express.Router();
var db = require("../config/connection");
var collection = require("../config/collection");
const { ObjectId } = require("mongodb");
const productHelpers = require('../helpers/product-helpers');
const userHelpers = require('../helpers/user-helper');
const { response } = require('../app');
const session = require('express-session');
/* GET home page. */
const verifylogin=(req,res,next)=>{ //middleware for cart(session creation)
  if(req.session.loggedIn){
    next()
  }else{
    res.redirect('/login')
  }
}

router.get('/', async function(req, res, next) {
  //cart count
  let user=req.session.user
  let cartCount=null
  if(req.session.user){
     cartCount= await userHelpers.getCartCount(req.session.user._id)
  }
  //get * products
  productHelpers.getAllProducts().then((products)=>{
      console.log(products)
      res.render('user/view-products',{products,user,cartCount})
    })
});

router.get('/login',(req,res)=>{
  if(req.session.loggedIn){
    res.redirect('/')
  }
  else{

    res.render('user/login',{"loginError":req.session.loginError})
    req.session.loginError=false
  }
  
})
router.get('/signup',(req,res)=>{
 res.render('user/signup')
})

router.post('/signup', (req, res) => {
  console.log("Received req.body:", req.body);  // Debugging line
  
  userHelpers.doSignup(req.body).then((response) => {
      console.log(response);
      
  })
  res.redirect('/login');
});

router.post('/login',(req,res)=>{
  userHelpers.doLogin(req.body).then((response)=>{
    if(response.status){
      req.session.loggedIn=true
      req.session.user=response.user
      res.redirect('/')
    }
    else{
      req.session.loginError=true
      res.redirect('/login');
    }
  }
  )
})

router.get('/logout',(req,res)=>{
  req.session.destroy()
  res.redirect('/')
})

router.get('/cart',verifylogin,async(req,res)=>{
  let products= await userHelpers.getcartProduct(req.session.user._id)
  let totalValue= await userHelpers.getTotalAmount(req.session.user._id)
  console.log(totalValue);
  console.log(products);
  res.render('user/cart',{products,user:req.session.user._id,totalValue})
})
router.get('/add-to-cart/:id',(req,res)=>{
  userHelpers.addToCart(req.params.id,req.session.user._id).then(()=>{
   // res.redirect('/')
   res.json({status:true})
  })
})

router.post('/change-product-quantity',(req,res,next)=>{
  console.log(req.body);
  userHelpers.changeProductQuantity(req.body).then(async(response)=>{
    response.total=await userHelpers.getTotalAmount(req.body.user)
    res.json(response)
  })

})
router.post('/remove-from-cart',(req,res)=>{
  userHelpers.removeFromCart(req.body).then((response)=>{
    res.json(response)
  })
})
router.get('/place-order',verifylogin,async(req,res)=>{
  let total=await userHelpers.getTotalAmount(req.session.user._id)
  res.render('user/place-order',{total,user:req.session.user})
})
router.post('/place-order',async(req,res)=>{
  console.log(req.body);
  let products=await userHelpers.getCartProductList(req.body.userId)
  let totalPrice=await userHelpers.getTotalAmount(req.body.userId)
  userHelpers.placeOrder(req.body,products,totalPrice).then((response)=>{
    res.render('user/order-success',{orderId:response.orderId,user:req.session.user})
  })
  })
router.get('/order-success',verifylogin,(req,res)=>{
  res.render('user/order-success',{user:req.session.user})
})
router.get('/orders/:id',async(req,res)=>{
  let orders=await userHelpers.getUserOrders(req.session.user._id)
  res.render('user/orders',{user:req.session.user,orders})
})
router.get('/orders', verifylogin, async (req, res) => {
  let orders = await userHelpers.getUserOrders(req.session.user._id);
  res.render('user/orders', { user: req.session.user, orders });
});
router.get('/order-details/:id', async (req, res) => {
  try {
    let orderId = req.params.id;

    // Get products for this order
    let orderProducts = await userHelpers.getOrderProducts(orderId);

    // Extract only required fields from aggregated results
    let products = orderProducts.map(op => ({
      name: op.product.Name,     
      price: op.product.Price,   
      quantity: op.quantity
    }));
    let orderDetails = await db
      .get()
      .collection(collection.ORDER_COLLECTION)
      .findOne({ _id: new ObjectId(orderId) });

    res.render("user/order-details", {
      user: req.session.user,
      orderDetails,
      products
    });

  } catch (error) {
    console.log("Order details error:", error);
  }
});
// filter setting
router.get('/view-products', async (req, res) => {
    try {
        let filterData = {
            brand: req.query.brand || "",
            price: req.query.price || "",
            sort: req.query.sort || "" // Added sort functionality
        };

        // Fetch data in parallel for better performance
        let [products, brands] = await Promise.all([
            productHelpers.getFilteredProducts(filterData),
            productHelpers.getAllBrands()
        ]);

        res.render('user/view-products', {
            products,
            brands,
            brandsCount: brands.length,
            selectedBrand: filterData.brand,
            selectedPrice: filterData.price,
            selectedSort: filterData.sort
        });
    } catch (err) {
        console.error("Filter Error:", err);
        res.status(500).send("Internal Server Error");
    }
});
module.exports = router;
