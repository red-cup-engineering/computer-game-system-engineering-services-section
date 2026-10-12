(local util (require :util))

(util.merge-models
 (util.load-model :gen/dimension)
 {:name "Teraum"
  :grammar {:article ""}
  :description "This is the universe of Teraum, a tragically funny fantasy world."
  :areas {"Eastlands" (util.load-model :teraum/eastlands/region)}})
