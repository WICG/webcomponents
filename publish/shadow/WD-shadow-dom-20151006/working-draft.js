function hideWIP(elem){
    elem.parentNode.parentNode.id = '';
    elem.parentNode.id = '';
    elem.style.display = 'none';
}
