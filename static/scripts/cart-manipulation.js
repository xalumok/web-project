$(document).ready(function()
{
    $('.add-to-cart').click(function(e)
    {
        e.preventDefault();
        $target =  $(e.target);
        const id = $target.attr('id');
        $.ajax({
            type: "PUT",
            url: "/cart/" + id,
            success: function(data)
            {
                alert(data);
            },  
            error: function(err)
            {
                console.log(err);
            }
        });
    });
    $('.delete-from-cart').click(function(e)
    {
        e.preventDefault();
        $target =  $(e.target);
        const id = $target.attr('id');
        $.ajax({
            method: "DELETE",
            url: "/cart/" + id,
            success: function(data)
            {
                alert(data);
                window.location.href = '/cart';
            },  
            error: function(err)
            {
                console.log(err);
            }
        });
    });
});