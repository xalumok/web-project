$(document).ready(function()
{
    $('.delete-tablet').click(function(e)
    {
        e.preventDefault();
        $target =  $(e.target);
        const id = $target.attr('id');
        
        $.ajax({
            method: "GET",
            url: "/ababa",
            success: function(data)
            {
                alert(data);
                window.location.href = '/index';
            },  
            error: function(err)
            {
                console.log(err);
            }
        });
    });
});