(local fennel (require :fennel))
(local util {:log-level :spam
             :view fennel.view
             :eval fennel.eval
             :doc fennel.doc})

;;; Logging

(local log-levels {:critical 1 :error 2 :warning 3
                   :info 4 :debug 5 :spam 6})

(fn util.log [level ...]
  {:fnl/docstring "Print MESSAGE (can be more than one string) if LEVEL is equal or greater to the configured log level."
   :fnl/arglist [level message]}
  (fn print-message [message]
    (print (.. (util.render-time (os.time) true)
               "> " level
               (if (= level :error) ":    "
                   (if (= level :warning) ":  "
                       (if (= level :info) ":     "
                           (if (= level :debug) ":    "
                               (if (= level :spam) ":     "
                                   ": ")))))
               message)))
  (when (>= (. log-levels util.log-level)
            (. log-levels level))
    (print-message (util.concat ...))))

;;; Strings

;;; Strings

(fn util.concat [...]
  (let [stab (table.pack ...)
        A (util.make-string-appender)]
    (set stab.n nil)
    (each [_ str (pairs stab)]
      (A str))
    (A)))


(fn util.make-string-appender [?sep]
  "Return a function that holds a string and accepts one atctional argument (string or list of strings). If provided, the argument is appended to the held string, with SEP appended (to each one, if its a list of strings.)"
  (var o "")
  (lambda [?a]
    (lambda q [r]
      (set o (.. o r (or ?sep ""))) o)
    (if ?a
        (if (or (= (type ?a) :string)
                (= (type ?a) :number))
            (q ?a)
            (each [_ v (pairs ?a)]
              (q v)))
        o)))



;;; Saving/Loading Data

(fn util.scan-directory [path ?recurse ?type ?strip-ext]
  "Return a list of files & directories at PATH, ?RECURSE-ing if true, limited to Files or Directories if F or D are given as the TYPE, and ?STRIP-EXT if true removes the file extension from the file names in the returned list."
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
  (util.log :debug (.. "Saving data to " path))
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
  "Return the evaluated contents at PATH, or the ?FALLBACK if there's no file at PATH. (Evaluated means, its been parsed by Fennel, i.e. if you load a file containing a table, load-file will return a table, not a string."
  (let [load-file (io.open (.. path ".fnl") :r)]
    (if load-file
        (let [loaded-data (load-file:read "*all")]
          (util.eval loaded-data))
        (if ?fallback
            (do
              (util.save-file ?fallback path true)
              (util.load-file path))
            (print (.. "No file at " path
                       " and no fallback given. Failed to load."))))))


(fn util.load-folder [path ?recurse]
  (local files-data {})
  (each [_ file-path (pairs (util.scan-directory path ?recurse :f))]
    (local id (: file-path :sub 0 -5))
    (tset files-data id (util.load-file (.. path :/ id))))
  files-data)

;;; Time

(fn util.render-time [time ?seconds]
  "Given a Lua timecode, renders it as YYYYMMDD:HHMM, appending ?SECONDS if true."
  (os.date (if ?seconds
               "%Y%m%d:%H%M%S"
               "%Y%m%d:%H%M")
           time))


util
