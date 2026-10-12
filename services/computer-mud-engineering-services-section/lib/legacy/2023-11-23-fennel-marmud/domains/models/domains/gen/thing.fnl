(local util (require :util))

(local thing {:name :thing
              :grammar {:article :a}})

(fn thing.fname [thing]
  (.. (if (and thing.grammar
               thing.grammar.article
               (not (= thing.grammar.article "")))
          (.. thing.grammar.article " ")
          "")
      thing.name))
(fn thing.describe [thing]
  (if thing.description
      thing.description
      (.. "This is " (thing:fname))))

thing
