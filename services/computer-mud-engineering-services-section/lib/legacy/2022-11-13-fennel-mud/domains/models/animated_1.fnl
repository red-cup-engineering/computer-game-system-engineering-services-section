;;;; animated thing model

{:name "animated thing"
 :base :thing
 :behaviors [:animated]
 :animations [[(fn [] (print "first animation")) 1 50]]}
