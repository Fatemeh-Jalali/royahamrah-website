//requirements
require("dotenv").config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const moment = require("moment-jalaali");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const flash = require("express-flash");
const session = require("express-session");

//mongoose models
const userSchema = new mongoose.Schema({
    user_username: String,
    user_password: String,
    user_is_admin: Boolean,
});
const User = mongoose.model("user", userSchema);

const productSchema = new mongoose.Schema({
    product_id: String,
    product_title: String,
});
const Product = mongoose.model("product", productSchema);

const basketSchema = new mongoose.Schema({
    basket_id: String,
    basket_time: String,
    basket_title: String,
    basket_products: [{
        basket_product_title: String,
        basket_product_color: String,
        basket_product_price: Number,
        basket_product_count: Number,
    }],
    basket_description: String,
});
const Basket = mongoose.model("basket", basketSchema);

//passport config
passport.use(
    new LocalStrategy(
        {
            usernameField: "username",
            passwordField: "password"
        },
        function(username, password, done){
            User.findOne({user_username: username}).then(function(foundUser){
                if(!foundUser){
                    return done(null, false, {
                        message: "کاربر یافت نشد."
                    });
                }else{
                    bcrypt.compare(password, foundUser.user_password, function(err, result){
                        if(result === true){
                            return done(null, foundUser);
                        }else{
                            return done(null, false, {
                                message: "رمز عبور اشتباه است."
                            });
                        }
                    });
                }
            });
        }
    )
);
passport.serializeUser(function(user, done){
    done(null, user.user_username);
});
passport.deserializeUser(function(userUsername, done){
    User.findOne({user_username: userUsername}).then(function(foundUser){
        return done(null, foundUser);
    });
});

//express config
app.set("view engine", "ejs");
app.use("/", express.static("public"));
app.use("/admin", express.static("public"));
//TODO: app.use("/other", express.static("public"));

app.use(express.urlencoded({
    extended: true
}));
app.use(flash());
app.use(session({
    secret: process.env.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());
mongoose.set("strictQuery", false);
mongoose.connect(
    process.env.MONGODB_URL,
    {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    }
);

//express routes
app.get("/", function(req, res){
    //check if admin does not exist
    User.findOne(null).then(function(anyUser){
        if(!anyUser){
            bcrypt.hash(process.env.ADMIN_PASSWORD, 10, function(err, hash){
                const adminUser = new User({
                    user_username: process.env.ADMIN_USERNAME,
                    user_password: hash,
                    user_is_admin: true
                });
                adminUser.save().then(function(err){
                    res.redirect("/");
                });
            });
        }else{
            //check if the user is logged in
            if(!req.isAuthenticated()){
                res.redirect("/login");
            }else{
                //check if the user is admin
                User.findOne({user_username: req.user.user_username}).then(function(currentUser){
                    if(currentUser.user_is_admin){
                        res.redirect("/admin");
                    }else{
                        //TODO: render normal user panel
                    }
                });
            }
        }
    });
});

app.get("/login", function(req, res){
    if(req.isAuthenticated()){
        res.redirect("/");
    }else{
        res.render("login");
    }
});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true
}));

app.get("/admin", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                Product.countDocuments(null).then(function(productCount){
                    Basket.countDocuments(null).then(function(basketCount){
                        res.render("admin", {
                            productCount: productCount,
                            basketCount: basketCount
                        });
                    });
                });
            }else{
                res.redirect("/");
            }
        });
    }
});

app.get("/admin/list-products", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                Product.find(null).then(function(allProducts){
                    res.render("admin_list-products", {
                        allProducts: allProducts
                    });
                });
            }else{
                res.redirect("/");
            }
        });
    }
});

app.get("/admin/add-product", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                res.render("admin_add-product");
            }else{
                res.redirect("/");
            }
        });
    }
});

app.post("/admin/add-product", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                if(req.body.title){
                    const newProduct = new Product({
                        product_id: new Date().getTime(),
                        product_title: req.body.title
                    });
                    newProduct.save().then(function(err){
                        res.redirect("/admin/list-products");
                    });
                }else{
                    res.redirect("/admin/list-products");
                }
            }else{
                res.redirect("/");
            }
        });
    }
});

app.get("/admin/edit-product", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                Product.findOne({product_id: req.query.id}).then(function(foundProduct){
                    if(!foundProduct){
                        res.render("msg", {
                            title: "محصول یافت نشد",
                            message: "محصولی با این آی دی در سیستم یافت نشد."
                        });
                    }else{
                        res.render("admin_edit-product", {
                            foundProduct: foundProduct
                        });
                    }
                });
            }else{
                res.redirect("/");
            }
        });
    }
});

app.post("/admin/edit-product", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                Product.findOne({product_id: req.query.id}).then(function(foundProduct){
                    if(!foundProduct){
                        res.redirect("/admin/list-products");
                    }else{
                        Product.updateOne({product_id: req.query.id}, {product_title: req.body.title}).then(function(err){
                            res.redirect("/admin/list-products");
                        });
                    }
                });
            }else{
                res.redirect("/");
            }
        });
    }
});

app.get("/admin/delete-product", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                Product.findOne({product_id: req.query.id}).then(function(foundProduct){
                    if(!foundProduct){
                        res.redirect("/admin/list-products");
                    }else{
                        Product.deleteOne({product_id: req.query.id}).then(function(err){
                            res.redirect("/admin/list-products");
                        });
                    }
                });
            }else{
                res.redirect("/");
            }
        });
    }
});

app.get("/admin/list-baskets", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                Basket.find(null).then(function(allBaskets){
                    res.render("admin_list-baskets", {
                        allBaskets: allBaskets,
                        moment: moment
                    });
                });
            }else{
                res.redirect("/");
            }
        });
    }
});

app.get("/admin/add-basket", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                Product.find(null).then(function(allProducts){
                    res.render("admin_add-basket", {
                        allProducts: allProducts
                    });
                });
            }else{
                res.redirect("/");
            }
        });
    }
});

app.post("/admin/add-basket", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                let basketProducts = [];
                req.body.product.forEach(function(item){
                    if(item.title && item.color && item.price && item.count){
                        basketProducts.push({
                            basket_product_title: item.title,
                            basket_product_color: item.color,
                            basket_product_price: item.price,
                            basket_product_count: item.count
                        });
                    }
                });
                if(basketProducts.length){
                    let tempEpoch = new Date().getTime();
                    const newBasket = new Basket({
                        basket_id: tempEpoch,
                        basket_time: tempEpoch,
                        basket_title: req.body.title ? req.body.title : "بدون عنوان",
                        basket_products: basketProducts,
                        basket_description: req.body.description ? req.body.description : "بدون توضیحات"
                    });
                    newBasket.save().then(function(err){
                        res.redirect("/admin/list-baskets");
                    });
                }else{
                    res.render("msg", {
                        title: "خطا در ایجاد سبد",
                        message: "برای ایجاد سبد تعریف حداقل یک محصول لازم است."
                    });
                }
            }else{
                res.redirect("/");
            }
        });
    }
});

app.get("/admin/edit-basket", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                Basket.findOne({basket_id: req.query.id}).then(function(foundBasket){
                    if(!foundBasket){
                        res.render("msg", {
                            title: "سبد یافت نشد",
                            message: "سبدی با این آی دی در سیستم یافت نشد."
                        });
                    }else{
                        Product.find(null).then(function(allProducts){

                            let foundBasketTotalPrice = 0;
                            foundBasket.basket_products.forEach(function(item){
                                foundBasketTotalPrice += (item.basket_product_price * item.basket_product_count);
                            });

                            res.render("admin_edit-basket", {
                                allProducts: allProducts,
                                foundBasket: foundBasket,
                                foundBasketTotalPrice: foundBasketTotalPrice.toLocaleString()
                            });
                        });
                    }
                });
            }else{
                res.redirect("/");
            }
        });
    }
});

app.post("/admin/edit-basket", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                Basket.findOne({basket_id: req.query.id}).then(function(foundBasket){
                    if(!foundBasket){
                        res.redirect("/admin/list-baskets");
                    }else{
                        let basketProducts = [];
                        req.body.product.forEach(function(item){
                            if(item.title && item.color && item.price && item.count){
                                basketProducts.push({
                                    basket_product_title: item.title,
                                    basket_product_color: item.color,
                                    basket_product_price: item.price,
                                    basket_product_count: item.count
                                });
                            }
                        });
                        if(basketProducts.length){
                            Basket.updateOne({basket_id: req.query.id}, {
                                basket_time: new Date().getTime(),
                                basket_title: req.body.title ? req.body.title : "بدون عنوان",
                                basket_products: basketProducts,
                                basket_description: req.body.description ? req.body.description : "بدون توضیحات"
                            }).then(function(err){
                                res.redirect("/admin/list-baskets");
                            });
                        }else{
                            res.render("msg", {
                                title: "خطا در ویرایش سبد",
                                message: "برای ویرایش سبد تعریف حداقل یک محصول لازم است."
                            });
                        }
                    }
                });
            }else{
                res.redirect("/");
            }
        });
    }
});

app.get("/admin/delete-basket", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                Basket.findOne({basket_id: req.query.id}).then(function(foundBasket){
                    if(!foundBasket){
                        res.redirect("/admin/list-baskets");
                    }else{
                        Basket.deleteOne({basket_id: req.query.id}).then(function(err){
                            res.redirect("/admin/list-baskets");
                        });
                    }
                });
            }else{
                res.redirect("/");
            }
        });
    }
});

app.get("/admin/change-password", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                res.render("admin_change-password");
            }else{
                res.redirect("/");
            }
        });
    }
});

app.post("/admin/change-password", function(req, res){
    if(!req.isAuthenticated()){
        res.redirect("/login");
    }else{
        //check if the user is admin
        User.findOne({user_username: req.user.user_username}).then(function(currentUser){
            if(currentUser.user_is_admin){
                if(req.body.oldpassword && req.body.password){
                    bcrypt.compare(req.body.oldpassword, currentUser.user_password, function(err, result){
                        if(result === true){
                            bcrypt.hash(req.body.password, 10, function(err, hash){
                                User.updateOne({user_username: currentUser.user_username}, {user_password: hash}).then(function(err){
                                    req.logOut(function(err){
                                        res.render("msg", {
                                            title: "تغییر رمز عبور موفق",
                                            message: "رمز عبور با موفقیت تغییر کرد. برای ادامه مجددا با رمز عبور جدید وارد شوید."
                                        });
                                    });
                                });
                            });
                        }else{
                            res.render("msg", {
                                title: "خطا در تغییر رمز عبور",
                                message: "رمز عبور قدیمی اشتباه است."
                            });
                        }
                    });
                }else{
                    res.render("msg", {
                        title: "خطا در تغییر رمز عبور",
                        message: "برای تغییر رمز عبور وارد کردن رمز قدیمی و جدید لازم است."
                    });
                }
            }else{
                res.redirect("/");
            }
        });
    }
});

app.get("/view-basket", function(req, res){
    Basket.findOne({basket_id: req.query.id}).then(function(foundBasket){
        if(!foundBasket){
            res.render("msg", {
                title: "سبد یافت نشد",
                message: "سبدی با این آی دی در سیستم یافت نشد."
            });
        }else{

            let foundBasketTotalPrice = 0;
            foundBasket.basket_products.forEach(function(item){
                foundBasketTotalPrice += (item.basket_product_price * item.basket_product_count);
            });

            res.render("view-basket", {
                foundBasket: foundBasket,
                foundBasketTotalPrice: foundBasketTotalPrice.toLocaleString(),
                moment: moment
            });
        }
    });
});

app.get("/logout", function(req, res){
    req.logOut(function(err){
        res.redirect("/login");
    });
});

app.get("/404", function(req, res){
    res.render("msg", {
        title: "خطای 404",
        message: "صفحه‌ای با این آدرس در وبسایت وجود ندارد."
    });
});

app.get("*", function(req, res){
    res.redirect("/404");
});

//express init
app.listen(process.env.PORT, function(){
    console.log("RoyaHamrah is running on port " + process.env.PORT);
});