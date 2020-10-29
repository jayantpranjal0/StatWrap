import fs from 'fs';
import os from 'os';
import ProjectService, { ProjectFileFormatVersion } from '../../app/services/project';
import Constants from '../../app/constants/constants';

jest.mock('fs');
jest.mock('os');

const TEST_USER_HOME_PATH = '/User/test/';
os.homedir.mockReturnValue(TEST_USER_HOME_PATH);

const projectString = `{
  "formatVersion": "1",
  "id": "d01d2925-f6ff-4f8e-988f-fca2ee193427",
  "name": "Test 1",
  "tags": [ "tag1", "tag2", "tag3" ]
}`;

const invalidProjectString = `{
  "id": "d01d2925-f6ff-4f8e-988f-fca2ee193427
}`;

describe('services', () => {
  describe('project', () => {
    afterEach(() => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
    });

    describe('loadProjectFile', () => {
      it('should resolve the ~ home path', () => {
        fs.readFileSync.mockReturnValue(projectString);
        const project = new ProjectService().loadProjectFile('~/Test/Path');
        expect(project).not.toBeNull();
        expect(fs.readFileSync).toHaveBeenCalledWith(
          `${TEST_USER_HOME_PATH}Test/Path/.statwrap-project.json`
        );
      });
      it('should return the project details', () => {
        fs.readFileSync.mockReturnValue(projectString);
        const project = new ProjectService().loadProjectFile('/Test/Path');
        expect(project).not.toBeNull();
        expect(fs.readFileSync).toHaveBeenCalledWith('/Test/Path/.statwrap-project.json');
      });
      it('should throw an exception if the JSON is invalid', () => {
        fs.readFileSync.mockReturnValue(invalidProjectString);
        // eslint-disable-next-line prettier/prettier
        expect(() => new ProjectService().loadProjectFile('/Test/Path')).toThrow(SyntaxError);
      });
      it('should return null if the file path does not exist', () => {
        fs.accessSync.mockImplementationOnce(() => {
          throw new Error();
        });
        const project = new ProjectService().loadProjectFile('/Test/Path');
        expect(project).toBeNull();
        expect(fs.readFileSync).not.toHaveBeenCalled();
      });
    });

    describe('saveProjectFile', () => {
      it('should resolve the ~ home path', () => {
        new ProjectService().saveProjectFile('~/Test/Path', { id: '1' });
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          `${TEST_USER_HOME_PATH}Test/Path/.statwrap-project.json`,
          '{"id":"1"}'
        );
      });
      it('should save the project details', () => {
        new ProjectService().saveProjectFile('/Test/Path', { id: '1' });
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          '/Test/Path/.statwrap-project.json',
          '{"id":"1"}'
        );
      });
      it('should throw an error if the project path is invalid', () => {
        fs.accessSync.mockImplementationOnce(() => {
          throw new Error();
        });
        expect(() =>
          new ProjectService().saveProjectFile('/Invalid/Test/Path', { id: '1' })
        ).toThrow(Error);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
      });
      it('should throw an error if the project is not defined with at least an ID', () => {
        const service = new ProjectService();
        expect(() => service.saveProjectFile('/Test/Path', null)).toThrow(Error);
        expect(() => service.saveProjectFile('/Test/Path', undefined)).toThrow(Error);
        expect(() => service.saveProjectFile('/Test/Path', {})).toThrow(Error);
        expect(fs.readFileSync).not.toHaveBeenCalled();
      });
    });

    describe('sanitizeFolderName', () => {
      it('should should handle null, undefined and empty input', () => {
        const service = new ProjectService();
        expect(service.sanitizeFolderName(null)).toBe('');
        expect(service.sanitizeFolderName(undefined)).toBe('');
        expect(service.sanitizeFolderName('')).toBe('');
      });

      it('should strip periods from the beginning of the folder name', () => {
        const service = new ProjectService();
        expect(service.sanitizeFolderName('.test')).toBe('test');
        expect(service.sanitizeFolderName(' .test')).toBe('test');
      });

      it('should strip periods from the end of the folder name', () => {
        const service = new ProjectService();
        expect(service.sanitizeFolderName('test.')).toBe('test');
        expect(service.sanitizeFolderName('test. ')).toBe('test');
      });

      it('should leave valid characters untouched', () => {
        const service = new ProjectService();
        expect(service.sanitizeFolderName('Simple example')).toBe('Simple example');
        expect(service.sanitizeFolderName('This is okay!')).toBe('This is okay!');
        expect(service.sanitizeFolderName('1+1=2')).toBe('1+1=2');
      });

      it('should trim anything over 255 characters', () => {
        const service = new ProjectService();
        const longName = 'a'.repeat(255);
        expect(service.sanitizeFolderName(longName)).toBe(longName);
        expect(service.sanitizeFolderName(`${longName}a`)).toBe(longName);
      });
    });

    describe('convertAndValidateProject', () => {
      it('should flag a null parameter as invalid', () => {
        const validationReport = new ProjectService().convertAndValidateProject(null);
        expect(validationReport.isValid).toBe(false);
        expect(validationReport.details).toBe('No project information was provided for validation');
      });

      it('should flag an undefined parameter as invalid', () => {
        const validationReport = new ProjectService().convertAndValidateProject(undefined);
        expect(validationReport.isValid).toBe(false);
        expect(validationReport.details).toBe('No project information was provided for validation');
      });

      it('should flag an unknown project type as invalid', () => {
        const validationReport = new ProjectService().convertAndValidateProject({
          directory: '/Test/Path',
          name: 'My Test Project',
          type: 'Invalid'
        });
        expect(validationReport.isValid).toBe(false);
        expect(validationReport.details).toBe('An unknown project type (Invalid) was specified.');
      });

      it('should create transform and create new ID and lastAccessed for a new project', () => {
        const validationReport = new ProjectService().convertAndValidateProject({
          directory: '/Test/Path',
          name: 'My Test Project',
          type: Constants.ProjectType.NEW_PROJECT_TYPE
        });
        expect(validationReport.isValid).toBe(true);
        expect(validationReport.details).toBe('');
        expect(validationReport.project).not.toBeNull();
        expect(validationReport.project.formatVersion).toBe(ProjectFileFormatVersion);
        expect(validationReport.project.id).not.toBe(null);
        expect(validationReport.project.id.length).toBe(36); // v4 UUID length, with hyphens
        expect(validationReport.project.path).toBe('/Test/Path/My Test Project');
        expect(validationReport.project.lastAccessed).not.toBe(null);
        expect(validationReport.project.lastAccessed.length).not.toBe(0);
        expect(validationReport.project.favorite).toBe(false);
        expect(validationReport.project.name).toBe('My Test Project');
      });

      it('should transform a relative root directory for a new project', () => {
        const validationReport = new ProjectService().convertAndValidateProject({
          directory: '~',
          name: 'My Test Project',
          type: Constants.ProjectType.NEW_PROJECT_TYPE
        });
        expect(validationReport.project.path).toBe(`${TEST_USER_HOME_PATH}My Test Project`);
      });

      it('should strip invalid characters from a new project name for the path', () => {
        const folderWithInvalidChars = '.My: Test** Project ??';
        const validationReport = new ProjectService().convertAndValidateProject({
          directory: '/Test/Path',
          name: folderWithInvalidChars,
          type: Constants.ProjectType.NEW_PROJECT_TYPE
        });
        expect(validationReport.project.name).toBe(folderWithInvalidChars);
        expect(validationReport.project.path).toBe('/Test/Path/My Test Project');
      });

      it('should create transform and create new ID and lastAccessed for an existing project', () => {
        const validationReport = new ProjectService().convertAndValidateProject({
          directory: '/Test/Path/My Test Project',
          type: Constants.ProjectType.EXISTING_PROJECT_TYPE
        });
        expect(validationReport.isValid).toBe(true);
        expect(validationReport.details).toBe('');
        expect(validationReport.project).not.toBeNull();
        expect(validationReport.project.formatVersion).toBe(ProjectFileFormatVersion);
        expect(validationReport.project.id).not.toBe(null);
        expect(validationReport.project.id.length).toBe(36); // v4 UUID length, with hyphens
        expect(validationReport.project.path).toBe('/Test/Path/My Test Project');
        expect(validationReport.project.lastAccessed).not.toBe(null);
        expect(validationReport.project.lastAccessed.length).not.toBe(0);
        expect(validationReport.project.favorite).toBe(false);
        expect(validationReport.project.name).toBe('My Test Project');
      });
    });

    describe('initializeNewProject', () => {
      it('should not try to initialize if the project is invalid', () => {
        const service = new ProjectService();
        expect(() => service.initializeNewProject(null)).toThrow(Error);
        expect(fs.mkdir).not.toHaveBeenCalled();
      });

      it('should throw an error if the project folder failed to create', () => {
        fs.accessSync.mockImplementationOnce(() => {
          throw new Error();
        });
        fs.mkdirSync = jest.fn().mockImplementationOnce(() => {
          throw new Error('Failed to create');
        });
        const service = new ProjectService();
        const saveProjectFile = jest.spyOn(service, 'saveProjectFile');
        expect(() =>
          service.initializeNewProject({
            formatVersion: ProjectFileFormatVersion,
            id: '1',
            name: 'Test',
            path: '/Invalid/dir'
          })
        ).toThrow(Error);
        expect(saveProjectFile).not.toHaveBeenCalled();
      });

      it('should not try to make the directory if it already exists', () => {
        fs.accessSync.mockImplementationOnce();
        const mkdirSync = jest.spyOn(fs, 'mkdirSync');

        const service = new ProjectService();
        service.loadProjectFile = jest.fn().mockReturnValue({ id: '1' });
        expect(() =>
          service.initializeNewProject({
            formatVersion: ProjectFileFormatVersion,
            id: '1',
            name: 'Test',
            path: '/Existing/Dir'
          })
        ).not.toThrow(Error);
        expect(mkdirSync).not.toHaveBeenCalled();
      });

      it('should not try to save the project config if one exists containing at least an ID', () => {
        const mkdirSync = jest.spyOn(fs, 'mkdirSync');

        const service = new ProjectService();
        const saveProjectFile = jest.spyOn(service, 'saveProjectFile');
        service.loadProjectFile = jest.fn().mockReturnValue({ id: '1' });
        service.initializeNewProject({
          formatVersion: ProjectFileFormatVersion,
          id: '1',
          name: 'Test',
          path: '/Invalid/dir'
        });
        expect(mkdirSync).not.toHaveBeenCalled();
        expect(saveProjectFile).not.toHaveBeenCalled();
      });

      it('should save the configuration file if a project folder exists, but the config is invalid', () => {
        const mkdirSync = jest.spyOn(fs, 'mkdirSync');

        const service = new ProjectService();
        const saveProjectFile = jest.spyOn(service, 'saveProjectFile');
        service.loadProjectFile = jest.fn().mockReturnValue(null);
        service.initializeNewProject({
          formatVersion: ProjectFileFormatVersion,
          id: '1',
          name: 'Test',
          path: '/Test/Path'
        });
        expect(saveProjectFile).toHaveBeenCalled();
        expect(mkdirSync).not.toHaveBeenCalled();
      });

      it('should create the directory and save the configuration file for a new, valid project', () => {
        fs.accessSync.mockImplementationOnce(() => {
          throw new Error();
        });

        const mkdirSync = jest.spyOn(fs, 'mkdirSync');

        const service = new ProjectService();
        const saveProjectFile = jest.spyOn(service, 'saveProjectFile');

        service.loadProjectFile = jest.fn().mockReturnValue(null);
        service.initializeNewProject({
          formatVersion: ProjectFileFormatVersion,
          id: '1',
          name: 'Test',
          path: '/Test/Path'
        });
        expect(saveProjectFile).toHaveBeenCalled();
        expect(mkdirSync).toHaveBeenCalled();
      });

      it('should not include template information if the template parameter is not fully specified', () => {
        fs.accessSync.mockImplementationOnce(() => {
          throw new Error();
        });

        const project = {
          formatVersion: ProjectFileFormatVersion,
          id: '1',
          name: 'Test',
          path: '/Test/Path'
        };
        const service = new ProjectService();
        service.loadProjectFile = jest.fn().mockReturnValue(null);
        expect(service.initializeNewProject(project).template).toBeUndefined();
        expect(service.initializeNewProject(project, {}).template).toBeUndefined();
        expect(service.initializeNewProject(project, { id: 1 }).template).toBeUndefined();
        expect(service.initializeNewProject(project, { version: 1 }).template).toBeUndefined();
      });

      it('should include template information if the template parameter is specified', () => {
        fs.accessSync.mockImplementationOnce(() => {
          throw new Error();
        });

        const project = {
          formatVersion: ProjectFileFormatVersion,
          id: '1',
          name: 'Test',
          path: '/Test/Path'
        };
        const template = { id: 'test', version: '1' };
        const service = new ProjectService();
        service.loadProjectFile = jest.fn().mockReturnValue(null);
        expect(service.initializeNewProject(project, template).template).toEqual(template);
      });

      it('should ignore non-id/version template information', () => {
        fs.accessSync.mockImplementationOnce(() => {
          throw new Error();
        });

        const project = {
          formatVersion: ProjectFileFormatVersion,
          id: '1',
          name: 'Test',
          path: '/Test/Path'
        };
        const template = { id: 'test', blah: 'test', version: '1', foo: 'bar' };
        const service = new ProjectService();
        service.loadProjectFile = jest.fn().mockReturnValue(null);
        const projectConfig = service.initializeNewProject(project, template);
        expect(projectConfig.template).not.toEqual(template);
        expect(projectConfig.template.id).toEqual(template.id);
        expect(projectConfig.template.version).toEqual(template.version);
      });
    });

    describe('addNotesToAssets', () => {
      it('should throw errors when the parameters are not defined', () => {
        const service = new ProjectService();
        expect(() => service.addNotesToAssets(null, null)).toThrow(
          'The assets object must be specified'
        );
        expect(() => service.addNotesToAssets(undefined, undefined)).toThrow(
          'The assets object must be specified'
        );
        expect(() => service.addNotesToAssets(null, {})).toThrow(
          'The assets object must be specified'
        );
        expect(() => service.addNotesToAssets(undefined, {})).toThrow(
          'The assets object must be specified'
        );
        expect(() => service.addNotesToAssets({}, null)).toThrow(
          'The assets object with notes must be specified'
        );
        expect(() => service.addNotesToAssets({}, undefined)).toThrow(
          'The assets object with notes must be specified'
        );
      });

      it('will initialize the root asset notes even if it does not exist', () => {
        const service = new ProjectService();
        const assets = { uri: '/Test/Asset' };
        const assetsWithNotes = { uri: '/Test/Asset ' };

        // Test when notes isn't defined
        let updatedAssets = service.addNotesToAssets(assets, assetsWithNotes);
        expect(updatedAssets.notes).toBeDefined();
        expect(updatedAssets.notes.length).toBe(0);

        // Test when notes is explicitly null
        assetsWithNotes.notes = null;
        updatedAssets = service.addNotesToAssets(assets, assetsWithNotes);
        expect(updatedAssets.notes).toBeDefined();
        expect(updatedAssets.notes.length).toBe(0);

        // Test when notes is explicitly undefined
        assetsWithNotes.notes = undefined;
        updatedAssets = service.addNotesToAssets(assets, assetsWithNotes);
        expect(updatedAssets.notes).toBeDefined();
        expect(updatedAssets.notes.length).toBe(0);
      });

      it('will copy over the notes for the root asset', () => {
        const service = new ProjectService();
        const assets = { uri: '/Test/Asset' };
        const assetsWithNotes = { uri: '/Test/Asset ', notes: [{ id: '1', content: 'Test' }] };

        const updatedAssets = service.addNotesToAssets(assets, assetsWithNotes);
        expect(updatedAssets.notes).toBeDefined();
        expect(updatedAssets.notes.length).toBe(1);
        expect(updatedAssets.notes[0]).toEqual(assetsWithNotes.notes[0]);
      });

      it('will copy over the notes for the child and descendant assets', () => {
        const service = new ProjectService();
        const assets = {
          uri: '/Test/Asset',
          children: [
            {
              uri: '/Test/Asset/1',
              children: [{ uri: '/Test/Asset/1/a' }]
            },
            {
              uri: '/Test/Asset/2',
              children: [{ uri: '/Test/Asset/2/a' }]
            }
          ]
        };
        const assetsWithNotes = {
          uri: '/Test/Asset',
          children: [
            {
              uri: '/Test/Asset/1',
              children: [{ uri: '/Test/Asset/1/a', notes: [{ id: '3', content: 'Test 3' }] }],
              notes: [{ id: '2', content: 'Test 2' }]
            }
          ]
        };

        const updatedAssets = service.addNotesToAssets(assets, assetsWithNotes);
        expect(updatedAssets.children[0].notes[0]).toEqual(assetsWithNotes.children[0].notes[0]);
        expect(updatedAssets.children[0].children[0].notes[0]).toEqual(
          assetsWithNotes.children[0].children[0].notes[0]
        );
        expect(updatedAssets.children[1].notes.length).toBe(0);
      });
    });
  });
});
