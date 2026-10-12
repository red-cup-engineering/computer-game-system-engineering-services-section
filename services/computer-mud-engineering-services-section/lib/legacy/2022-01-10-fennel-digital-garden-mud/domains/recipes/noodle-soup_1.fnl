;; the ; means what comes after is a comment
;; using two is tradish

;; "" contain strings (a sequence of characters, "Bleep blorp, hazzle faff!")
;; : can be put before one-word strings (:this or :that)
;; {} holds a table
;; tables are made of key-value pairs
;; a key is always a string, but its value can be anything.
;; keys and values always are paired together
;; {:count 5} is a valid table
;; {:count 5 10} isn't
;; [] holds a sequence
;; sequences are ordered lists
;; they can contain anything

;; this function is used to help simulate cooking

;; a recipe is a table:
{:name "noodle soup" ; common name for the recipe
 :prep-time [5 15] ; sequence of two numbers, how long it takes to prepare: fastest, and slowest
 :cook-time [2 5] ; same idea, for cooking
 :servings 1 ; how many folk will it feed?
 :result {}
 :tools {:required [:cook-pot ; what tools do you need? can be one item or list of options
                    :stove 
                    [:chopsticks :fork]] 
         :optional [:knife ; what tools make it easier, or let you work with optional materials?
                    :cutting-board]}
 :materials {:required [[:water 1 :quart] ; same idea as tools, but each material is a squence of 
                        [:noodles :X :gram]] ; the material, its quantity, and its unit of measure
             :optional [[:tuna 80 :gram]]} ; material can be one number, or a min-max sequence like time
 ;; instructions seem straight-forward: English-form step-by-step
 :instructions ["Bring the water to a boil."
                "Add the noodles to the water."
                "Add the tuna to the water."
                "Wait approximately 2 minutes, up to five."
                "Serve hot."]
 ;; open questions, use their answers to improve this recipe
 :queries ["How many grams of noodles does it take, per serving?"}
