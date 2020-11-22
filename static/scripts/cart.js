let add = (id, name, price, res, req) => 
{
  if (req.signedCookies.cartList === undefined)
  {
    var cartList = [{name : name, price : price}];
    res.cookie('cartList', JSON.stringify(cartList), {signed: true});
  } else
  {
    var cartList = req.signedCookies.cartList;
    cartList.add({name : name, price : price});
  }
};

let remove = (id, res, req) => 
{
  if (req.signedCookies.cartList === undefined)
  {
    console.log("empty cart list. nothing to remove");
  } else
  {
    var cartList = req.signedCookies.cartList;
    cartList.splice(id, 1);
    res.cookie('cartList', JSON.stringify(cartList), {signed: true});
  }
};


module.exports = {
    add: add,
    remove: remove
};