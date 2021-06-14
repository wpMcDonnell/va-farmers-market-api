const express = require('express')
const passport = require('passport')
const multer = require('multer')
const storage = multer.memoryStorage()
const upload = multer({ storage })
const Post = require('../models/post')
const User = require('../models/user')

const requireToken = passport.authenticate('bearer', { session: false })
const customErrors = require('../../lib/custom_errors')
const handle404 = customErrors.handle404
const requireOwnership = customErrors.requireOwnership

const router = express.Router()
const s3Upload = require('../../lib/s3_upload')
const removeBlanks = require('../../lib/remove_blank_fields')

router.post('/vendors', requireToken, upload.single('post'), (req, res, next) => {
  console.log('this is my req.file when upload', req.file)
  console.log('this is my req.user when text', req.user)
  s3Upload(req.file)
    .then(awsFile => {
      return Post.create({ url: awsFile.Location, owner: req.user.id, title: req.body.title, market: req.body.market })
    })
  //  req.body => { upload: { url: 'www.blank.com' } }
    .then(postDoc => {
      res.status(201).json({ post: postDoc })
      console.log('This is picdoc', postDoc)
    })
    .catch(next)
})

// this would just get post data
// INDEX aka GET all
router.get('/vendors', requireToken, (req, res, next) => {
  // find all posts where the privacy of the owner is false
  // if the owner is getting the posts, show them their posts as well
  console.log(req.user, 'my user')
  Post.find()
    .then(handle404)
    .then(posts => {
      posts = posts.map(post => post.toObject())
      return Promise.all(posts.map(post => {
        return User.findById(post.owner).then(owner => {
          console.log(owner._id.toString(), req.user.id.toString())
          if (!owner.privacy || owner._id.toString() === req.user.id.toString()) {
            post.ownerName = owner.username
            return post
          } else {
            return 'private'
          }
        })
      }))
    }).then(posts => {
      console.log(posts)
      res.status(200).json({ posts })
    }).catch(next)
})

router.get('/vendors', (req, res, next) => {
  // find all posts where the privacy of the owner is false
  // if the owner is getting the posts, show them their posts as well
  Post.find()
    .then(handle404)
    .then(posts => {
      posts = posts.map(post => post.toObject())
      return Promise.all(posts.map(post => {
        return User.findById(post.owner).then(owner => {
          console.log(owner._id.toString())
          if (!owner.privacy) {
            post.ownerName = owner.username
            return post
          } else {
            return 'private'
          }
        })
      }))
    }).then(posts => {
      console.log(posts)
      res.status(200).json({ posts })
    }).catch(next)
})

//
// INDEX aka GET all
// router.get('/home', requireToken, (req, res, next) => {
//   Post.find({ owner: req.user.id })
//     .then(handle404)
//     .then(posts => {
//       posts = posts.map(post => post.toObject())
//       return Promise.all(posts.map(post => {
//         return User.findById(post.owner).then(owner => {
//           post.ownerName = owner.usernamecol
//           return post
//         })
//       }))
//     }).then(posts => {
//       res.status(200).json({ posts })
//     }).catch(next)
// })

// // SHOW aka get by id
router.get('/vendors/:id', (req, res, next) => {
  Post.findById(req.params.id)
    .then(handle404)
    .then(post => post.toObject())
    .then(post => User.findById(post.owner)
      .then(owner => {
        post.ownerName = owner.username
        return post
      })
      .then(post => {
        res.status(200).json({ post: post })
      })
    )
    .catch(next)
})

// // UPDATE post caption
router.patch('/vendors/:id', removeBlanks, (req, res, next) => {
  delete req.body.post.owner
  Post.findById(req.params.id)
    .then(handle404)
    .then(post => {
      // requireOwnership(req, post)
      return post.updateOne(req.body.post)
    })
    .then(() => res.sendStatus(204))
    .catch(next)
})
// DELETE
router.delete('/vendors/:id', requireToken, (req, res, next) => {
  Post.findById(req.params.id)
    .then(handle404)
    .then(post => {
      requireOwnership(req, post)
      post.deleteOne()
      Post.deleteOne()
    })
    .then(() => res.sendStatus(204))
    .catch(next)
})

module.exports = router
