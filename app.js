//// -------------- Database CONFIG
/**/ const host = ""
/**/ const user = ""
/**/ const password = ""
/**/ const database = ""
//// -------------- END

//// -------------- App CONFIG
/**/ const backend = "http://service16.scb.co.th:9898/user"
//// -------------- END

const mysql = require('mysql')
const axios = require('axios')
const fs = require('fs')
const fs2 = require('fs')

const conn = mysql.createConnection({
  host,
  user,
  password,
  database,
})

// Database connect
conn.connect(err => {
  if (err) throw err

  console.log(new Date() + " starting ..")

  // Load Input data
  fs.readFile("input.txt", "utf8", (err, contents) => {
    if (err) throw err

    var rows = contents.toString().split("\n")
    var inputs = rows.map(row => ({
      created_date: row.substring(9, 13) + "-" + row.substring(7, 9) + "-" + row.substring(5, 7),
      running_number: row.substring(13, 17),
    }))

    console.log(new Date() + " input parsed ..")

    // Search Data(application_id,application_type) from application_data using date&running number
    // Assume that field application_type is indicated the application_form_type table name.
    var sqlAppData = "SELECT application_id, application_type FROM application_data"
    var whereAppdata = inputs.map(input => Object.keys(input).map(key => key + "='" + input[key] + "'").join(" AND ")).map(input => "(" + input + ")")

    conn.query(sqlAppData + " WHERE " + whereAppdata.join(" OR "), (err, resultAppData) => {
      if (err) throw err

      console.log(new Date() + " application_data retrieved ..")

      var aValues = []
      var bValues = []
      var cValues = []

      resultAppData.forEach(appData => {
        if (appData.application_type === "A") aValues.push(appData.application_id)
        else if (appData.application_type === "B") bValues.push(appData.application_id)
        else cValues.push(appData.application_id)
      })

      // -------- abc
      var userIds = []
      var abcCount = 0
      const abcCallback = () => {
        abcCount++
        if (abcCount === 3) {
          // Get address infomation by user_id
          var sqlUser = "SELECT user_id, address1, address2, address3 FROM user_profile WHERE user_id IN (?)"
          conn.query(sqlUser, [userIds.map(user => user.user_id)], (err, resultUser) => {
            if (err) throw err

            userIds.forEach((userId, count) => {
              console.log("----------------" + new Date())
              console.log("#" + (count + 1) + " request data: " + JSON.stringify(resultUser.find(ru => ru.user_id === userId.user_id)))
              axios.post(
                backend,
                JSON.stringify(resultUser[0]),
                {
                  headers: {
                    "X-RequestID": (new Date()).getTime(),
                    "Content-Type": "application/json"
                  }
                },
              ).then(resp => {
                console.log("----------------" + new Date())
                console.log("#" + (count + 1) + " response data: " + JSON.stringify(resp.data))
              })

              fs.appendFile("output.txt", new Date() + ": " + JSON.stringify(resultUser[0]) + "\n", err => {
                if (err) throw err
              })
            })
          })
        }
      }

      // -------- a
      var sqlAppType = "SELECT user_id FROM application_form_type_a WHERE application_id IN (?)"
      conn.query(sqlAppType, [aValues], (err, resultA) => {
        if (err) throw err

        console.log(new Date() + " retrieved user_id for form_type_a ..")
        userIds = userIds.concat(resultA)
        abcCallback()
      })

      // -------- b
      var sqlAppType = "SELECT user_id FROM application_form_type_b WHERE application_id IN (?)"
      conn.query(sqlAppType, [bValues], (err, resultB) => {
        if (err) throw err

        console.log(new Date() + " retrieved user_id for form_type_b ..")
        userIds = userIds.concat(resultB)
        abcCallback()
      })

      // -------- c
      var sqlAppType = "SELECT user_id FROM application_form_type_c WHERE application_id IN (?)"
      conn.query(sqlAppType, [cValues], (err, resultC) => {
        if (err) throw err

        console.log(new Date() + " retrieved user_id for form_type_c ..")
        userIds = userIds.concat(resultC)
        abcCallback()
      })
    })
  })
})