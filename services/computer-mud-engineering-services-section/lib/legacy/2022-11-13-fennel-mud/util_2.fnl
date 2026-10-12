;;;; Tabby Utility Functions

(local fennel (require :fennel))
(local conf (require :conf))

(local util {})

(local log-levels {:critical 1 :error 2 :warning 3
                   :info 4 :debug 5 :spam 6})

;;; Logging

(fn util.log [level message]
  (fn print-message []
    (print (.. (util.render-time (os.time))
               "> " level
               (if (= level :error) ":    "
                   (if (= level :warning) ":  "
                       (if (= level :info) ":     "
                           (if (= level :debug) ":    "
                               (if (= level :spam) ":     "
                                   ": ")))))
               message)))
  (when (>= (. log-levels conf.log-level)
            (. log-levels level))
    (print-message)))

;;; Strings

(fn util.make-string-appender [?sep]
  "Return a function that holds a string and accepts one atctional argument (string or list of strings). If provided, the argument is appended to the held string, with SEP appended (to each one, if its a list of strings.)"
  (var o "")
  (lambda [?a]
    (lambda q [r]
      (set o (.. o r (or ?sep ""))) o)
    (if ?a
        (if (= (type ?a) :string)
              (q ?a)
              (each [_ v (pairs ?a)]
                (q v)))
        o)))

(fn util.quibble-strings [strings ?resort ?oxfordize]
  "Return the sequence of STRINGS separated with commas and the conjunction 'and'. ?OXFORDIZE is currently irrelevant; strings are oxfordized by defualt."
  (let [oxfordize (or ?oxfordize true)
        o (util.make-string-appender)]
    (when ?resort (table.sort strings))
    (var join "")
    (for [count 1
          (length strings) 1]
      (if (= count (length strings))
          (set join "")
          (= count (- (length strings) 1))
          (set join
               (.. (if (and oxfordize
                            (> (length strings) 2))
                       ","
                       "")
                   " and "))
          (set join ", "))
      (o [(. strings count) join]))
    (o)))

(fn util.split-string [string ?sep]
  (let [words []
        matcher (string.gmatch string (or ?sep "%S+"))]
    (var done? nil)
    (while (not done?)
      (let [word (matcher)]
        (if word
            (table.insert words word)
            (set done? true))))
    words))

;;; Time

(fn util.render-time [time]
  (os.date "%Y%m%d:%H%M" time))


;;; Files

(fn util.scan-directory [path ?recurse ?type ?strip-ext]
  (local matches {})
  (local A (util.make-string-appender))
  (A ["find \"" path "\""])
  (when (not ?recurse) (A " -maxdepth 1"))
  (when ?type (A [" -type " ?type]))
  (let [results (io.popen (A))]
    (each [result _ (results:lines)]
      (let [line (string.sub result (+ 2 (length path)))]
        (when (> (length line) 0)
          (table.insert matches (if ?strip-ext
                                    (: line :sub 0 -5)
                                    line))))))
  matches)

(fn util.save-file [data path ?force]
  (match (io.open (.. path :.fnl) :w)
    sfile (do (sfile:write (fennel.view data))
              (sfile:close))
    (_ err) (if ?force
                (do (os.execute
                 (.. "mkdir "
                     (string.match path "(.*[/\\])")))
                    (util.save-file data path))
                err)))

(fn util.load-file [path ?fallback]
  (let [load-file (io.open (.. path ".fnl") :r)]
    (if load-file
        (let [loaded-data (load-file:read "*all")]
          (fennel.eval loaded-data))
        (if ?fallback
            (do
              (util.save-file ?fallback path)
              (util.load-file path))
            (print (.. "No file at " path
                       " and no fallback given. Failed to load."))))))
(fn util.load-folder [path ?recurse]
  (local files-data {})
  (each [_ file-path (pairs (util.scan-directory path ?recurse :f))]
    (local id (: file-path :sub 0 -5))
    (tset files-data id (util.load-file (.. path :/ id))))
  files-data)

;;; Tables

(fn util.collect-keys [tbl]
  "Return a list of the keys in TBL."
  (icollect [key _ (pairs tbl)] key))

(fn util.add-values [tab addn]
  (each [k v (pairs addn)]
    (tset tab k v)))

(fn util.remove-value [tab val]
  (each [key value (pairs tab)]
    (when (= value val)
      (table.remove tab key)))
  tab)

(fn util.clone-table [tab ?addn]
  (let [clone (collect [k v (pairs tab)] k v)]
    (when ?addn (util.add-values clone ?addn))
    clone))

;;; Sequences

(fn util.find-element [seq query]
  (let [matched []]
    (each [_ element (pairs seq)]
      (when (= element query)
        (table.insert matched element)))
    (if (> (length matched) 0) true nil)))

(fn util.drop-dupes [seq]
  (local clean {})
  (each [key val (pairs seq)]
    (when (not (util.find-element clean val))
      (table.insert clean val)))
  clean)

(fn util.reverse-list [list]
  (let [rev []]
    (for [i (length list) 1 -1]
      (tset rev (+ (length rev) 1) (. list i)))
      rev))

(fn util.find-by [tbl f ?i]
  (let [x (. tbl (or ?i 1))]
    (if (= nil x) nil
        (or (f x)
            (util.find-by tbl f (+ 1 (or ?i 1)))))))

;;; Things

(fn util.lookup-behavior [key behavior-name]
  (let [behavior-file (util.load-file (.. :behaviors/ behavior-name))]
    (if behavior-file
        (. behavior-file key)
        (util.log :error (.. "Failed to find behavior file" behavior-name)))))
(fn util.lookup-behavior-method [thing key]
   (util.find-by thing.behaviors (partial util.lookup-behavior key)))

(fn util.lookup-command [command]
  (util.load-file (.. :commands/ command)))

(fn util.load-model [model-name]
  (util.load-file (.. (or conf.model-folder :models)
                      :/ model-name)))

(fn util.clone-model [model-name]
  (collect [k v (pairs (util.load-model model-name))] k v))

(fn util.collect-bases [thing ?collection ?prefix]
  (let [collection (or ?collection [])]
    (when thing.base
      (if (= (type thing.base) :string)
          (let [model-name thing.base
                model (util.load-model thing.base)]
            (when model.base
              (util.collect-bases model collection true))
            (if ?prefix
                (table.insert collection 1 model-name)
                (table.insert collection model-name))
            (set thing.base nil))
          (= (type thing.base) :table)
          (for [i (length thing.base) 1 -1]
            (let [model-name (. thing.base i)
                  model (util.load-model model-name)]
              (when model.base (util.collect-bases model collection true))
              (if ?prefix
                  (table.insert collection 1 model-name)
                  (table.insert collection model-name)))
            (table.remove thing.base i)
            (when (= (length thing.base) 0) (set thing.base nil)))))
    collection))


(fn util.merge-models [base addn]
  (fn merge-lists [start mergein]
    (each [_ item (pairs mergein)]
      (table.insert start item))
    (util.drop-dupes start))
  (each [k v (pairs addn)]
    (if (or (and base.additive-attributes
                 (util.find-element base.additive-attributes k))
            (and addn.additive-attributes
                 (util.find-element addn.additive-attributes k)))
        (do (when (not (. base k)) (tset base k {}))
            (each [q p (pairs v)]
              (if (= (type q) :number)
                  (do (table.insert (. base k) p)
                      (tset base k (util.drop-dupes (. base k))))
                  (tset (. base k) q p))))
        (= k :grammar)
        (do (when (not base.grammar) (set base.grammar {}))
            (each [q p (pairs v)]
              (when (or (= q :noun)
                        (= q :nouns))
                (when (not base.grammar.nouns) (set base.grammar.nouns [])))
              (if (= q :noun)
                  (table.insert base.grammar.nouns p)
                  (= q :nouns)
                  (set base.grammar.nouns (merge-lists base.grammar.nouns p))
                  (= q :adjectives)
                  (do (when (not base.grammar.adjectives) (set base.grammar.adjectives []))
                      (set base.grammar.adjectives (merge-lists base.grammar.adjectives p)))
                  (tset base.grammar q p))))
        (do (tset base k v))))
  base)


(fn util.make-model [model-name ?addn ?dimension]
  (let [made-thing {}
        base-collection []
        model (util.clone-model model-name)]
    (util.collect-bases model base-collection)
    (when ?addn (util.collect-bases ?addn base-collection))
    (let [clean-base-collection (util.reverse-list
                                 (util.drop-dupes base-collection))]
      (each [_ base-model-name (pairs clean-base-collection)]
        (util.merge-models made-thing (util.load-model base-model-name))))
    (set model.base nil)
    (util.merge-models made-thing model)
    (when ?addn
      (set ?addn.base nil)
      (util.merge-models made-thing ?addn))
    (when (or (not made-thing.behaviors)
              (and made-thing.behaviors
                   (= (length made-thing.behaviors) 0)))
      (set made-thing.behaviors [:thing]))
    (set made-thing.behaviors (util.drop-dupes made-thing.behaviors))
    (setmetatable made-thing {:__index util.lookup-behavior-method})
    (when ?dimension (set made-thing.dimension ?dimension))
    made-thing))

(fn util.search-things-by-term [things term ?matches]
  "Search the list of THINGS by TERM, adding them to ?MATCHES (or a fresh list)."
  (let [matches (or ?matches [])]
    (each [_ item (pairs things)]
      (when (item:term=? term)
        (table.insert matches item)))
    matches))

util
