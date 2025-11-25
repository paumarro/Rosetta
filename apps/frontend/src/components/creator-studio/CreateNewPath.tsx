import DashboardLayout from '@/components/dashboard/DashboardLayout';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SearchSkillForm } from '@/components/welcome/search-skill-form';
import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';

const BE_API_URL = import.meta.env.VITE_BE_API_URL as string;
const DEV_EDITOR_FE_URL = import.meta.env.VITE_DEV_EDITOR_FE_URL as string;

export default function CreateNewPath({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const [pathName, setPathName] = useState<string>('');
  const [pathNameCharacterCount, setPathNameCharacterCount] =
    useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [skills, setSkills] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const handleSearchSubmit = (value: string) => {
    if (value.trim() && !skills.includes(value.trim())) {
      setSkills([...skills, value.trim()]);
      setSearchValue(''); //Clear the input after adding
    }
  };
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const formData = {
      pathName: pathName,
      description: description,
      skills: skills,
    };

    const LP_API_URL = `${BE_API_URL}/api/learning-paths`;

    try {
      const response = await fetch(LP_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      console.log('response:', response);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status.toString()}`);
      }

      window.location.href = `${DEV_EDITOR_FE_URL}editor/${pathName}`;
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error submitting form:', err.message);
      } else {
        console.error('Unknown error submitting form:', err);
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="bg-muted flex h-full flex-col items-center justify-center gap-6  p-6 md:p-10">
        {/* <h1 className="text-xl">Create a Game-Changing Learning Path</h1>
        <h2>Share your experience, empower the community</h2> */}
        <div className="max-w-sm">
          <div className={cn('flex flex-col ', className)} {...props}>
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">
                  Create a Learning Path
                </CardTitle>
                <CardDescription>
                  Share your experience, empower the community
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    void handleSubmit(e);
                  }}
                >
                  <div className="grid gap-6">
                    <div className="grid gap-3">
                      <Label htmlFor="path-name">Learning Path Name</Label>
                      <p className="text-sm text-muted-foreground">
                        Give your path an inspiring name for the community
                      </p>
                      <Input
                        id="path-name"
                        type="text"
                        placeholder="Add a short name..."
                        required
                        value={pathName}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPathName(value);
                          setPathNameCharacterCount(value.length);
                        }}
                        maxLength={50}
                      />
                      <div className="text-xs text-muted-foreground text-right">
                        {pathNameCharacterCount}/50
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="description">Description</Label>
                      <p className="text-sm text-muted-foreground">
                        Give your path a short description for the community
                      </p>
                      <Textarea
                        id="description"
                        placeholder="Add a short description..."
                        required
                        value={description}
                        onChange={(
                          e: React.ChangeEvent<HTMLTextAreaElement>,
                        ) => {
                          setDescription(e.target.value);
                        }}
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                    <div className="grid gap-3">
                      <Label htmlFor="skills">Skills</Label>
                      <p className="text-sm text-muted-foreground">
                        These are the superpowers 🔥 your path will unlock for
                        learners.
                      </p>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-6">
                        <div className="grid gap-3">
                          <SearchSkillForm
                            className="w-full"
                            inputValue={searchValue}
                            onInputChange={setSearchValue}
                            onSearch={handleSearchSubmit}
                            placeholder="Add a skill"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                      <span className="bg-card text-muted-foreground relative z-10 px-2">
                        Your skills
                      </span>
                    </div>

                    {/* Selected skills */}
                    <div className="grid gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {skills.length > 0 ? (
                          skills.map((skill, index) => (
                            <div
                              key={index}
                              className="relative group inline-block"
                            >
                              <Badge
                                key={index}
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() => {
                                  //Remove skill when clicked
                                  setSkills(skills.filter((s) => s !== skill));
                                }}
                                title="Click to remove"
                              >
                                {skill}
                                <span className="absolute rounded-full bg-background text-muted-foreground border border-border w-4 h-4 flex items-center justify-center -right-1 -top-1  opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="size-2" />
                                </span>
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No skills added yet
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-6">
                      <Button type="submit" className="w-full">
                        Start Building <ChevronRight />
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
            <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
              Your learning path will join our collection of expert roadmaps
              helping self-starters level up every day.
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
