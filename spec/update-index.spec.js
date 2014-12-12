var fs = require("fs");
var g = require("../src/gitlet");
var util = require("../src/util");
var nodePath = require("path");
var testUtil = require("./test-util");

describe("update-index", function() {
  beforeEach(testUtil.initTestDataDir);

  it("should throw if not in repo", function() {
    expect(function() { g.update_index(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  describe("pathspec stipulations", function() {
    it("should throw if path does not match existing working copy file", function() {
      g.init();
      expect(function() { g.update_index("blah"); })
        .toThrow("error: blah: does not exist and --remove not passed\n");
    });

    it("should throw rel path if not in root and pathspec does not match file", function() {
      g.init();
      testUtil.createFilesFromTree({ "1": { "2": {}}})
      process.chdir("1/2");
      expect(function() { g.update_index("blah"); })
        .toThrow("error: 1/2/blah: does not exist and --remove not passed\n");
    });

    it("should throw rel path if not in root and path is dir", function() {
      g.init();
      testUtil.createFilesFromTree({ "1": { "2": {}}})
      process.chdir("1");
      expect(function() { g.update_index("2"); })
        .toThrow("error: 1/2: is a directory - add files inside instead\n");
    });
  });

  describe("adding files to index", function() {
    it("should add a file to an empty index and create object", function() {
      g.init();

      var content = "this is a readme";
      fs.writeFileSync("README.md", content);
      g.update_index("README.md", { add: true });

      testUtil.expectFile(nodePath.join(".gitlet/objects", util.hash(content)), content);

      expect(testUtil.index()[0].path).toEqual("README.md");
    });

    it("should add file to index with stuff in it", function() {
      g.init();
      testUtil.createFilesFromTree({ "README1.md": "this is a readme1", "README2.md":"this is a readme2"});
      g.update_index("README1.md", { add: true });
      g.update_index("README2.md", { add: true });

      testUtil.expectFile(nodePath.join(".gitlet/objects", util.hash("this is a readme1")),
                          "this is a readme1");
      testUtil.expectFile(nodePath.join(".gitlet/objects", util.hash("this is a readme2")),
                          "this is a readme2");

      expect(testUtil.index()[0].path).toEqual("README1.md");
      expect(testUtil.index()[1].path).toEqual("README2.md");
    });

    it("should allow adding file repeatedly", function() {
      g.init();
      testUtil.createFilesFromTree({ filea: "filea", });
      g.update_index("filea", { add: true });
      g.update_index("filea");
      g.update_index("filea");

      testUtil.expectFile(nodePath.join(".gitlet/objects", util.hash("filea")), "filea");
      expect(testUtil.index()[0].path).toEqual("filea");
    });

    it("should throw if try to add new file w/o --add flag", function() {
      g.init();
      fs.writeFileSync("README.md", "this is a readme");

      expect(function() { g.update_index("README.md"); })
        .toThrow("error: README.md: cannot add to the index - missing --add option?\n");
    });

    it("should still refer to staged version if file changes after stage", function() {
      g.init();
      fs.writeFileSync("README.md", "this is a readme");
      g.update_index("README.md", { add: true });
      fs.writeFileSync("README.md", "this is a readme1");

      testUtil.expectFile("README.md", "this is a readme1");
      expect(testUtil.index()[0].hash).toEqual(util.hash("this is a readme"));
    });

    it("should update file hash in index and add new obj if update file", function() {
      g.init();
      fs.writeFileSync("README.md", "this is a readme");
      g.update_index("README.md", { add: true });
      expect(testUtil.index()[0].hash)
        .toEqual(util.hash("this is a readme")); // sanity check hash added for first version

      // update file and update index again
      fs.writeFileSync("README.md", "this is a readme1");
      g.update_index("README.md");

      var newVersionHash = testUtil.index()[0].hash;

      testUtil.expectFile(nodePath.join(".gitlet/objects", newVersionHash), "this is a readme1");
      expect(newVersionHash).toEqual(util.hash("this is a readme1"));
    });
  });

  describe("removing files from index", function() {
    it("should do nothing if --remove passed and file not disk, not in index", function() {
      g.init();
      expect(g.update_index("filea", { remove: true })).toEqual("\n");
    });

    it("should see --remove as attempt to add if file on disk but not in index", function() {
      g.init();
      testUtil.createFilesFromTree({ filea: "filea" });
      expect(fs.existsSync("filea")).toEqual(true); // sanity
      expect(testUtil.index().length).toEqual(0); // sanity

      expect(function() { g.update_index("filea", { remove: true }); })
        .toThrow("error: filea: cannot add to the index - missing --add option?\n");
    });

    it("shouldn't rm file from index/disk if --remove, file on disk, file in idx", function() {
      g.init();
      testUtil.createFilesFromTree({ filea: "filea" });
      g.add("filea", { add: true });
      expect(fs.existsSync("filea")).toEqual(true); // sanity
      expect(testUtil.index()[0].path).toEqual("filea"); // sanity

      g.update_index("filea", { remove: true });
      expect(testUtil.index().length).toEqual(1); // not gone
      expect(fs.existsSync("filea")).toEqual(true); // not gone
    });

    it("should rm file from index if --remove, file not on disk, file in index", function() {
      g.init();
      testUtil.createFilesFromTree({ filea: "filea" });
      g.add("filea", { add: true });
      expect(fs.existsSync("filea")).toEqual(true); // sanity

      fs.unlinkSync("filea");
      expect(fs.existsSync("filea")).toEqual(false); // sanity
      expect(testUtil.index()[0].path).toEqual("filea"); // sanity
      g.update_index("filea", { remove: true });
      expect(testUtil.index().length).toEqual(0); // gone
    });
  });
});
